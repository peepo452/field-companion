import {
  NDVI_CLASSES,
  NDVI_EXPRESSION,
  STAC_API,
  TILER,
  bboxAround,
  type NdviStats,
  type NdviZone,
  type SatelliteReport,
  type Scene,
} from "./satellite";

type StacFeature = {
  id: string;
  properties: { datetime: string; "eo:cloud_cover"?: number };
};

async function jsonFetch<T>(url: string, init?: RequestInit, ms = 30_000): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    if (!res.ok) throw new Error(`${url.split("?")[0]} failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

function itemUrlFor(id: string) {
  return `${STAC_API}/collections/sentinel-2-l2a/items/${id}`;
}

async function searchScenes(
  bbox: [number, number, number, number],
  from: string,
  to: string,
  maxCloud: number,
  limit = 60,
): Promise<{ id: string; date: string; cloud: number }[]> {
  const body = {
    collections: ["sentinel-2-l2a"],
    bbox,
    datetime: `${from}T00:00:00Z/${to}T23:59:59Z`,
    limit,
    query: { "eo:cloud_cover": { lt: maxCloud } },
    sortby: [{ field: "properties.datetime", direction: "desc" }],
  };
  const data = await jsonFetch<{ features: StacFeature[] }>(`${STAC_API}/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return (data.features ?? []).map((f) => ({
    id: f.id,
    date: f.properties.datetime.slice(0, 10),
    cloud: Math.round(f.properties["eo:cloud_cover"] ?? 0),
  }));
}

async function ndviStats(itemUrl: string, bbox: [number, number, number, number]): Promise<NdviStats | null> {
  const q = new URLSearchParams();
  q.set("url", itemUrl);
  q.append("assets", "red");
  q.append("assets", "nir");
  q.set("expression", NDVI_EXPRESSION);
  q.set("max_size", "128");
  const feature = {
    type: "Feature",
    properties: {},
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [bbox[0], bbox[1]],
          [bbox[2], bbox[1]],
          [bbox[2], bbox[3]],
          [bbox[0], bbox[3]],
          [bbox[0], bbox[1]],
        ],
      ],
    },
  };
  try {
    const data = await jsonFetch<{ properties: { statistics: Record<string, Record<string, number | number[][]>> } }>(
      `${TILER}/stac/statistics?${q.toString()}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(feature) },
      45_000,
    );
    const s = Object.values(data.properties?.statistics ?? {})[0];
    if (!s || typeof s["mean"] !== "number" || Number.isNaN(s["mean"] as number)) return null;
    return {
      mean: s["mean"] as number,
      min: s["min"] as number,
      max: s["max"] as number,
      std: s["std"] as number,
      median: s["median"] as number,
      histogram: s["histogram"] as unknown as [number[], number[]],
    };
  } catch {
    return null;
  }
}

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

/** Keep at most one scene (the clearest) per `bucketDays` window. */
function thinScenes(scenes: { id: string; date: string; cloud: number }[], bucketDays: number, max: number) {
  const kept: { id: string; date: string; cloud: number }[] = [];
  for (const s of scenes) {
    const t = new Date(s.date).getTime();
    const clash = kept.findIndex((k) => Math.abs(new Date(k.date).getTime() - t) < bucketDays * 86_400_000);
    if (clash === -1) kept.push(s);
    else if (s.cloud < kept[clash]!.cloud) kept[clash] = s;
    if (kept.length >= max) break;
  }
  return kept.slice(0, max);
}

function zonesFrom(stats: NdviStats | null): NdviZone[] {
  const base = NDVI_CLASSES.map((c) => ({ key: c.key, label: c.label, hint: c.hint, color: c.color, pct: 0 }));
  const hist = stats?.histogram;
  if (!hist || !Array.isArray(hist[0]) || !Array.isArray(hist[1])) return base;
  const [counts, edges] = hist;
  const total = counts.reduce((a, b) => a + b, 0);
  if (!total) return base;
  counts.forEach((count, i) => {
    const mid = ((edges[i] ?? 0) + (edges[i + 1] ?? 0)) / 2;
    const cls = NDVI_CLASSES.find((c) => mid < c.upTo) ?? NDVI_CLASSES[NDVI_CLASSES.length - 1]!;
    const target = base.find((b) => b.key === cls.key)!;
    target.pct += (count / total) * 100;
  });
  return base.map((z) => ({ ...z, pct: Math.round(z.pct) }));
}

export async function buildSatelliteReport(lat: number, lon: number, hectares: number): Promise<SatelliteReport> {
  const bbox = bboxAround(lat, lon, hectares);
  const today = new Date();
  const from = new Date(today.getTime() - 150 * 86_400_000);

  let found = await searchScenes(bbox, iso(from), iso(today), 40);
  let note: string | null = null;
  if (found.length === 0) {
    found = await searchScenes(bbox, iso(from), iso(today), 90);
    if (found.length) note = "Only cloudy passes were available — readings may be dampened by cloud.";
  }
  if (found.length === 0) {
    return {
      bbox,
      hectares,
      latest: null,
      series: [],
      baselineMean: null,
      baselineYears: 0,
      anomaly: null,
      zones: zonesFrom(null),
      note: "No usable Sentinel-2 pass found for this location in the last 5 months.",
    };
  }

  // Recent time series: clearest pass per ~12-day window, newest first.
  const recent = thinScenes(found, 12, 7);
  const recentStats = await Promise.all(recent.map((s) => ndviStats(itemUrlFor(s.id), bbox)));
  const series: Scene[] = recent
    .map((s, i) => ({ ...s, itemUrl: itemUrlFor(s.id), stats: recentStats[i] ?? null }))
    .filter((s) => s.stats !== null)
    .reverse(); // oldest → newest

  const latest = series.length ? series[series.length - 1]! : null;
  if (!latest) note = note ?? "Sentinel-2 passed over recently but the field reading could not be computed.";

  // Anomaly baseline: same calendar window in each of the previous 3 years.
  const baselineMeans: number[] = [];
  const years = [1, 2, 3];
  const perYear = await Promise.all(
    years.map(async (back) => {
      const centre = new Date(today);
      centre.setFullYear(centre.getFullYear() - back);
      const a = new Date(centre.getTime() - 12 * 86_400_000);
      const b = new Date(centre.getTime() + 12 * 86_400_000);
      const scenes = await searchScenes(bbox, iso(a), iso(b), 30, 20).catch(() => []);
      const pick = thinScenes(scenes, 30, 1)[0];
      if (!pick) return null;
      return await ndviStats(itemUrlFor(pick.id), bbox);
    }),
  );
  perYear.forEach((s) => {
    if (s) baselineMeans.push(s.mean);
  });

  const baselineMean = baselineMeans.length
    ? baselineMeans.reduce((a, b) => a + b, 0) / baselineMeans.length
    : null;

  return {
    bbox,
    hectares,
    latest,
    series,
    baselineMean,
    baselineYears: baselineMeans.length,
    anomaly: latest && baselineMean != null ? latest.stats!.mean - baselineMean : null,
    zones: zonesFrom(latest?.stats ?? null),
    note,
  };
}
