import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { ClientOnly } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { getSatelliteReport } from "@/lib/satellite.functions";
import { NDVI_CLASSES, anomalyVerdict, classifyNdvi, type SatelliteReport } from "@/lib/satellite";

const NdviMap = lazy(() => import("./NdviMap"));

type Props = { latitude: number; longitude: number; placeName: string };

const AREA_PRESETS = [
  { label: "1 acre", ha: 0.4 },
  { label: "2.5 acres", ha: 1 },
  { label: "5 acres", ha: 2 },
  { label: "12 acres", ha: 5 },
  { label: "30 acres", ha: 12 },
];

function fmt(v: number | null | undefined, digits = 2) {
  return v == null || Number.isNaN(v) ? "—" : v.toFixed(digits);
}

function prettyDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const w = 260;
  const h = 54;
  const min = Math.min(...values, 0.05);
  const max = Math.max(...values, min + 0.1);
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * (w - 4) + 2;
    const y = h - 4 - ((v - min) / (max - min)) * (h - 10);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-14 w-full" role="img" aria-label="NDVI trend over recent satellite passes">
      <polyline points={pts.join(" ")} fill="none" stroke="currentColor" strokeWidth={2} className="text-forest-2" />
      {pts.map((p, i) => {
        const [x, y] = p.split(",");
        return <circle key={i} cx={x} cy={y} r={2.5} className="fill-forest" />;
      })}
    </svg>
  );
}

export function SatellitePanel({ latitude, longitude, placeName }: Props) {
  const fetchReport = useServerFn(getSatelliteReport);
  const [hectares, setHectares] = useState(2);
  const [report, setReport] = useState<SatelliteReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [layer, setLayer] = useState<"ndvi" | "true">("ndvi");
  const [opacity, setOpacity] = useState(0.85);
  const [sceneIdx, setSceneIdx] = useState<number | null>(null);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError(null);
    setReport(null);
    setSceneIdx(null);
    fetchReport({ data: { lat: latitude, lon: longitude, hectares } })
      .then((r) => {
        if (live) setReport(r as SatelliteReport);
      })
      .catch((e: unknown) => {
        if (live) setError(e instanceof Error ? e.message : "Satellite service unavailable right now.");
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latitude, longitude, hectares]);

  const scene = useMemo(() => {
    if (!report?.series.length) return null;
    const idx = sceneIdx ?? report.series.length - 1;
    return report.series[Math.min(idx, report.series.length - 1)] ?? null;
  }, [report, sceneIdx]);

  const verdict = anomalyVerdict(report?.anomaly ?? null);
  const verdictTone: Record<string, string> = {
    bad: "bg-danger-bg border-danger-line text-danger-text",
    watch: "bg-surplus-bg border-surplus-line text-surplus-text",
    ok: "bg-secondary border-border text-forest",
    good: "bg-forest-light border-forest-light text-forest",
  };

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Satellite view</p>
          <h4 className="mt-1 font-display text-xl font-semibold">See the field from orbit</h4>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Copernicus Sentinel-2 photographs {placeName} roughly every 5 days. We turn the red and near-infrared bands
            into NDVI — a published greenness index that tracks canopy vigour — and compare it with this same field's
            own history.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Field size</span>
        {AREA_PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => setHectares(p.ha)}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
              hectares === p.ha
                ? "border-forest bg-forest text-primary-foreground"
                : "border-border bg-card hover:bg-accent"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="mt-4 space-y-3">
          <div className="h-72 overflow-hidden rounded-2xl bg-secondary skeleton-sheen" />
          <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            Pulling recent Sentinel-2 passes and 3 years of history…
          </p>
        </div>
      )}

      {!loading && error && (
        <div className="mt-4 rounded-xl border border-danger-line bg-danger-bg px-4 py-3 text-xs text-danger-text">
          {error}
        </div>
      )}

      {!loading && report && (
        <>
          {report.note && (
            <p className="mt-4 rounded-xl border border-surplus-line bg-surplus-bg px-4 py-3 text-xs text-surplus-text">
              {report.note}
            </p>
          )}

          {scene && (
            <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-card shadow-card">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    Sentinel-2 pass
                  </p>
                  <p className="text-sm font-semibold">
                    {prettyDate(scene.date)} · {scene.cloud}% cloud
                  </p>
                </div>
                <div className="flex items-center gap-1 rounded-full border border-border p-1">
                  {(
                    [
                      ["ndvi", "NDVI"],
                      ["true", "True colour"],
                    ] as const
                  ).map(([k, l]) => (
                    <button
                      key={k}
                      onClick={() => setLayer(k)}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                        layer === k ? "bg-forest text-primary-foreground" : "text-muted-foreground hover:bg-accent"
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              <div className="h-80 w-full">
                <ClientOnly fallback={<div className="h-full w-full bg-secondary skeleton-sheen" />}>
                  <Suspense fallback={<div className="h-full w-full bg-secondary skeleton-sheen" />}>
                    <NdviMap
                      lat={latitude}
                      lon={longitude}
                      bbox={report.bbox}
                      itemUrl={scene.itemUrl}
                      layer={layer}
                      opacity={opacity}
                    />
                  </Suspense>
                </ClientOnly>
              </div>

              <div className="flex flex-wrap items-center gap-4 border-t border-border px-4 py-3">
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  Layer opacity
                  <input
                    type="range"
                    min={20}
                    max={100}
                    value={Math.round(opacity * 100)}
                    onChange={(e) => setOpacity(Number(e.target.value) / 100)}
                    className="w-28 accent-forest"
                  />
                </label>
                <div className="flex flex-1 flex-wrap items-center gap-2">
                  {NDVI_CLASSES.map((c) => (
                    <span key={c.key} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <span className="h-2.5 w-4 rounded-sm" style={{ background: c.color }} />
                      {c.label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {report.series.length > 1 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {report.series.map((s, i) => {
                const active = (sceneIdx ?? report.series.length - 1) === i;
                return (
                  <button
                    key={s.id}
                    onClick={() => setSceneIdx(i)}
                    className={`rounded-lg border px-2.5 py-1.5 font-mono text-[10px] transition-colors ${
                      active ? "border-forest bg-forest-light text-forest" : "border-border hover:bg-accent"
                    }`}
                  >
                    {s.date.slice(5)} · {fmt(s.stats?.mean)}
                  </button>
                );
              })}
            </div>
          )}

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-border bg-linear-to-b from-secondary/70 to-card p-4">
              <p className="eyebrow">Field greenness (NDVI)</p>
              <p className="mt-1 font-display text-2xl font-bold">{fmt(report.latest?.stats?.mean)}</p>
              <p className="font-mono text-xs text-muted-foreground">
                {report.latest?.stats ? classifyNdvi(report.latest.stats.mean).label : "no reading"}
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-linear-to-b from-secondary/70 to-card p-4">
              <p className="eyebrow">{report.baselineYears || 3}-year average, same date</p>
              <p className="mt-1 font-display text-2xl font-bold">{fmt(report.baselineMean)}</p>
              <p className="font-mono text-xs text-muted-foreground">
                {report.baselineYears ? `${report.baselineYears} past season${report.baselineYears === 1 ? "" : "s"}` : "no history found"}
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-linear-to-b from-secondary/70 to-card p-4">
              <p className="eyebrow">Anomaly vs. history</p>
              <p className="mt-1 font-display text-2xl font-bold">
                {report.anomaly == null ? "—" : `${report.anomaly > 0 ? "+" : ""}${report.anomaly.toFixed(2)}`}
              </p>
              <p className="font-mono text-xs text-muted-foreground">
                {report.anomaly == null ? "needs history" : report.anomaly < 0 ? "below normal" : "at or above normal"}
              </p>
            </div>
          </div>

          {verdict && (
            <div className={`mt-3 rounded-2xl border p-5 ${verdictTone[verdict.tone]}`}>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] opacity-70">Remote-sensing read</p>
              <p className="mt-2 font-display text-lg font-bold">{verdict.title}</p>
              <p className="mt-1.5 text-sm leading-relaxed opacity-90">{verdict.text}</p>
            </div>
          )}

          {report.zones.some((z) => z.pct > 0) && (
            <div className="mt-4 rounded-2xl border border-border bg-card p-4">
              <p className="eyebrow">Where the field stands, patch by patch</p>
              <div className="mt-3 flex h-4 overflow-hidden rounded-full">
                {report.zones.map((z) =>
                  z.pct > 0 ? (
                    <span
                      key={z.key}
                      title={`${z.label}: ${z.pct}%`}
                      style={{ width: `${z.pct}%`, background: z.color }}
                    />
                  ) : null,
                )}
              </div>
              <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
                {report.zones
                  .filter((z) => z.pct > 0)
                  .map((z) => (
                    <li key={z.key} className="flex items-center gap-2 text-xs">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: z.color }} />
                      <span className="font-semibold">{z.pct}%</span>
                      <span className="text-muted-foreground">
                        {z.label} — {z.hint}
                      </span>
                    </li>
                  ))}
              </ul>
              <p className="mt-3 text-xs text-muted-foreground">
                Percentages cover the {report.hectares < 1 ? `${(report.hectares * 2.47).toFixed(1)}-acre` : `${(report.hectares * 2.47).toFixed(1)}-acre`} box drawn on the map. Zoom in on the NDVI layer to see exactly which corner is dragging the average down.
              </p>
            </div>
          )}

          {report.series.length > 1 && (
            <div className="mt-4 rounded-2xl border border-border bg-card p-4">
              <p className="eyebrow">Greenness trend, recent passes</p>
              <Sparkline values={report.series.map((s) => s.stats?.mean ?? 0)} />
              <p className="font-mono text-[11px] text-muted-foreground">
                {report.series[0]!.date} → {report.series[report.series.length - 1]!.date}
              </p>
            </div>
          )}

          <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
            Imagery: Copernicus Sentinel-2 L2A, European Space Agency, free and open. NDVI = (NIR − Red) / (NIR + Red),
            averaged over the box above at 10 m resolution. Cloud, haze and recently irrigated soil can all shift a
            single reading — trust the trend and the anomaly more than one number.
          </p>
        </>
      )}
    </section>
  );
}
