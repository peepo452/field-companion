/**
 * Client-safe Sentinel-2 / NDVI helpers.
 *
 * Imagery: Copernicus Sentinel-2 L2A open data (ESA), catalogued by the public
 * Element 84 Earth Search STAC API and rendered on the fly by the public
 * TiTiler service. No API key, no account.
 */

export const STAC_API = "https://earth-search.aws.element84.com/v1";
export const TILER = "https://titiler.xyz";
export const NDVI_EXPRESSION = "(b2-b1)/(b2+b1)"; // b1 = red, b2 = nir (asset order)

export type NdviStats = {
  mean: number;
  min: number;
  max: number;
  std: number;
  median: number;
  /** [counts, binEdges] as returned by the tiler */
  histogram?: [number[], number[]];
};

export type Scene = {
  id: string;
  /** ISO date (YYYY-MM-DD) of acquisition */
  date: string;
  cloud: number;
  itemUrl: string;
  stats: NdviStats | null;
};

export type NdviZone = {
  key: "bare" | "poor" | "fair" | "good" | "vigorous";
  label: string;
  hint: string;
  color: string;
  pct: number;
};

export type SatelliteReport = {
  bbox: [number, number, number, number];
  hectares: number;
  latest: Scene | null;
  /** oldest → newest, one entry per usable revisit */
  series: Scene[];
  baselineMean: number | null;
  baselineYears: number;
  /** latest.mean − baselineMean (negative = stressed vs. its own history) */
  anomaly: number | null;
  zones: NdviZone[];
  note: string | null;
};

/** Square field footprint around a point, sized by area in hectares. */
export function bboxAround(lat: number, lon: number, hectares: number): [number, number, number, number] {
  const half = Math.sqrt(Math.max(hectares, 0.25) * 10_000) / 2; // metres
  const dLat = half / 111_320;
  const dLon = half / (111_320 * Math.max(Math.cos((lat * Math.PI) / 180), 0.01));
  return [lon - dLon, lat - dLat, lon + dLon, lat + dLat];
}

function tilerQuery(params: Record<string, string | string[]>) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (Array.isArray(v)) v.forEach((item) => q.append(k, item));
    else q.append(k, v);
  }
  return q.toString();
}

export function ndviTileUrl(itemUrl: string) {
  const q = tilerQuery({
    url: itemUrl,
    assets: ["red", "nir"],
    expression: NDVI_EXPRESSION,
    rescale: "0,0.9",
    colormap_name: "rdylgn",
    nodata: "0",
  });
  return `${TILER}/stac/tiles/WebMercatorQuad/{z}/{x}/{y}.png?${q}`;
}

export function trueColorTileUrl(itemUrl: string) {
  const q = tilerQuery({ url: itemUrl, assets: "visual", nodata: "0" });
  return `${TILER}/stac/tiles/WebMercatorQuad/{z}/{x}/{y}.png?${q}`;
}

export const NDVI_CLASSES: { key: NdviZone["key"]; label: string; hint: string; color: string; upTo: number }[] = [
  { key: "bare", label: "Bare / severe", hint: "Soil, water or a failed patch", color: "#a3423c", upTo: 0.2 },
  { key: "poor", label: "Weak", hint: "Thin stand or real stress", color: "#d98324", upTo: 0.4 },
  { key: "fair", label: "Developing", hint: "Early canopy or mild stress", color: "#e8c547", upTo: 0.6 },
  { key: "good", label: "Healthy", hint: "Well-developed canopy", color: "#6aa84f", upTo: 0.8 },
  { key: "vigorous", label: "Vigorous", hint: "Dense, peak-season canopy", color: "#1f6b3b", upTo: 1.01 },
];

export function classifyNdvi(v: number) {
  return NDVI_CLASSES.find((c) => v < c.upTo) ?? NDVI_CLASSES[NDVI_CLASSES.length - 1]!;
}

export function anomalyVerdict(anomaly: number | null) {
  if (anomaly == null) return null;
  if (anomaly <= -0.15)
    return {
      tone: "bad" as const,
      title: "Well below its own history",
      text: "Greenness is far under the multi-year average for this field at this time of year — treat this as a stress signal and scout the field.",
    };
  if (anomaly <= -0.06)
    return {
      tone: "watch" as const,
      title: "Slightly behind history",
      text: "Greenness is a little under the multi-year average for this date. Worth a walk-through before it becomes visible.",
    };
  if (anomaly >= 0.08)
    return {
      tone: "good" as const,
      title: "Ahead of its own history",
      text: "The canopy is greener than this field's multi-year average for this date.",
    };
  return {
    tone: "ok" as const,
    title: "Normal for this field",
    text: "Greenness is in line with the multi-year average for this location and date.",
  };
}
