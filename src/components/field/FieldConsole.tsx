import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";
import { CROPS, DEFAULT_CROP, getCrop, type Crop } from "@/lib/crops";
import {
  growthProgress,
  recommendation,
  stageForProgress,
  stageWindows,
  waterBalance,
  weatherAlerts,
  type Alert,
  type DailyWeather,
  type Recommendation,
  type WaterBalance,
} from "@/lib/agronomy";
import { fetchWeather, geocode, localISODate, type Place } from "@/lib/weather";
import { SeasonArc } from "./SeasonArc";
import { BalanceChart } from "./BalanceChart";
import { ProtectionPanel } from "./ProtectionPanel";
import { SatellitePanel } from "./SatellitePanel";
import { sprayWindow, type SprayWindow } from "@/lib/protection";

type SavedField = {
  id: string;
  crop: string;
  location: string;
  planting_date: string;
  latitude: number | null;
  longitude: number | null;
};

type Analysis = {
  crop: Crop;
  place: Place;
  plantingDate: string;
  daysSincePlanting: number;
  planning: boolean;
  progress: number;
  gddBased: boolean;
  accumulatedGdd: number;
  avgDailyGdd7: number;
  paceRatio: number;
  projectedHarvestDay: number;
  stage: ReturnType<typeof stageForProgress>;
  wb: WaterBalance | null;
  alerts: Alert[];
  rec: Recommendation | null;
  avgSolar: number;
  spray: SprayWindow | null;
};

function daysBetween(fromISO: string, today: Date) {
  const [y, m, d] = fromISO.split("-").map(Number);
  const plant = new Date(y!, (m ?? 1) - 1, d ?? 1);
  plant.setHours(0, 0, 0, 0);
  const t = new Date(today);
  t.setHours(0, 0, 0, 0);
  return Math.round((t.getTime() - plant.getTime()) / 86400000);
}

function formatDate(iso: string, offsetDays = 0) {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y!, (m ?? 1) - 1, d ?? 1);
  date.setDate(date.getDate() + offsetDays);
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

const familyOrder = ["Cereal", "Legume", "Oilseed", "Fibre", "Root & Tuber", "Vegetable", "Sugar"] as const;

export function FieldConsole() {
  const [session, setSession] = useState<Session | null>(null);
  const [savedFields, setSavedFields] = useState<SavedField[]>([]);
  const [email, setEmail] = useState("");
  const [authNote, setAuthNote] = useState<string | null>(null);

  const [cropKey, setCropKey] = useState(DEFAULT_CROP.key);
  const [location, setLocation] = useState("");
  const [plantingDate, setPlantingDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [saveNote, setSaveNote] = useState<string | null>(null);

  const crop = getCrop(cropKey);
  const grouped = useMemo(
    () => familyOrder.map((f) => ({ family: f, items: CROPS.filter((c) => c.family === f) })).filter((g) => g.items.length),
    [],
  );

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) {
      setSavedFields([]);
      return;
    }
    void loadFields();
  }, [session]);

  async function loadFields() {
    const { data } = await supabase
      .from("fields")
      .select("id, crop, location, planting_date, latitude, longitude")
      .order("created_at", { ascending: false });
    setSavedFields((data as SavedField[]) ?? []);
  }

  async function sendMagicLink() {
    if (!email.trim()) {
      setAuthNote("Enter your email first.");
      return;
    }
    setAuthNote("Sending…");
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.href },
    });
    setAuthNote(err ? err.message : "Check your inbox for the sign-in link.");
  }

  async function saveField() {
    if (!session || !analysis) return;
    const { error: err } = await supabase.from("fields").insert({
      user_id: session.user.id,
      crop: analysis.crop.key,
      location: analysis.place.name,
      planting_date: analysis.plantingDate,
      latitude: analysis.place.latitude,
      longitude: analysis.place.longitude,
    });
    setSaveNote(err ? `Couldn't save: ${err.message}` : "Field saved.");
    if (!err) void loadFields();
  }

  async function deleteField(id: string) {
    await supabase.from("fields").delete().eq("id", id);
    void loadFields();
  }

  async function run(nextCrop: string, nextLocation: string, nextDate: string, place?: Place) {
    setError(null);
    setSaveNote(null);
    if (!nextLocation.trim()) return setError("Please enter your field location.");
    if (!nextDate) return setError("Please choose your planting date.");

    setLoading(true);
    try {
      const activeCrop = getCrop(nextCrop);
      const resolved = place ?? (await geocode(nextLocation));
      const daysSincePlanting = daysBetween(nextDate, new Date());

      if (daysSincePlanting < 0) {
        setAnalysis({
          crop: activeCrop,
          place: resolved,
          plantingDate: nextDate,
          daysSincePlanting,
          planning: true,
          progress: 0,
          gddBased: false,
          accumulatedGdd: 0,
          avgDailyGdd7: 0,
          paceRatio: 1,
          projectedHarvestDay: activeCrop.seasonDays,
          stage: stageForProgress(activeCrop, 0),
          wb: null,
          alerts: [],
          rec: null,
          avgSolar: 0,
          spray: null,
        });
        return;
      }

      const weather: DailyWeather = await fetchWeather(resolved, daysSincePlanting);
      const prog = growthProgress(activeCrop, weather, daysSincePlanting);
      const stage = stageForProgress(activeCrop, prog.progress);
      const wb = waterBalance(activeCrop, weather, daysSincePlanting, prog.progressAt);
      const alerts = weatherAlerts(activeCrop, weather, stage);
      const rec = recommendation(activeCrop, wb, stage, alerts);

      let solar = 0;
      let n = 0;
      for (let i = Math.max(0, weather.todayIdx - 7); i < weather.todayIdx; i++) {
        solar += weather.solar[i] ?? 0;
        n++;
      }

      setAnalysis({
        crop: activeCrop,
        place: resolved,
        plantingDate: nextDate,
        daysSincePlanting,
        planning: false,
        progress: prog.progress,
        gddBased: prog.gddBased,
        accumulatedGdd: prog.accumulatedGdd,
        avgDailyGdd7: prog.avgDailyGdd7,
        paceRatio: prog.paceRatio,
        projectedHarvestDay: prog.projectedHarvestDay,
        stage,
        wb,
        alerts,
        rec,
        avgSolar: n ? solar / n : 0,
        spray: sprayWindow(weather.precip, weather.tmax, weather.tmin, weather.todayIdx),
      });
    } catch (e) {
      setAnalysis(null);
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function loadSaved(f: SavedField) {
    setCropKey(f.crop);
    setLocation(f.location);
    setPlantingDate(f.planting_date);
    const place =
      f.latitude != null && f.longitude != null
        ? { name: f.location, latitude: f.latitude, longitude: f.longitude }
        : undefined;
    void run(f.crop, f.location, f.planting_date, place);
  }

  const paceLabel =
    !analysis || analysis.planning
      ? ""
      : analysis.paceRatio >= 1.15
        ? "Ahead of typical pace"
        : analysis.paceRatio <= 0.85
          ? "Behind typical pace"
          : "On typical pace";

  const toneStyles: Record<Recommendation["tone"], string> = {
    water: "bg-danger-bg border-danger-line text-danger-text",
    ok: "bg-forest-light border-forest-light text-forest",
    watch: "bg-surplus-bg border-surplus-line text-surplus-text",
    plan: "bg-secondary border-border text-forest",
  };

  return (
    <div className="grid gap-0 overflow-hidden rounded-3xl border border-border bg-card shadow-panel lg:grid-cols-[380px_1fr]">
      {/* ---------------- Left: inputs ---------------- */}
      <div className="relative border-b border-border bg-linear-to-b from-forest-light/70 to-card p-6 lg:border-b-0 lg:border-r">

        {session ? (
          <div className="mb-5 rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold">Signed in</p>
                <p className="truncate text-xs text-muted-foreground">{session.user.email}</p>
              </div>
              <button
                onClick={() => void supabase.auth.signOut()}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent"
              >
                Sign out
              </button>
            </div>
          </div>
        ) : (
          <div className="mb-5 rounded-2xl border border-border bg-card p-4">
            <p className="text-sm font-semibold">Save your fields</p>
            <p className="mt-1 text-xs text-muted-foreground">Sign in with just your email — no password.</p>
            <div className="mt-3 flex gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="min-w-0 flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
              />
              <button
                onClick={() => void sendMagicLink()}
                className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                Send link
              </button>
            </div>
            {authNote && <p className="mt-2 text-xs text-muted-foreground">{authNote}</p>}
          </div>
        )}

        {session && (
          <div className="mb-5">
            <p className="eyebrow">My fields</p>
            {savedFields.length === 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">Nothing saved yet — check a field, then save it.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {savedFields.map((f) => {
                  const c = getCrop(f.crop);
                  return (
                    <li key={f.id} className="flex items-center gap-2 rounded-xl border border-border bg-card p-3">
                      <button onClick={() => loadSaved(f)} className="min-w-0 flex-1 text-left">
                        <span className="font-mono text-[10px] uppercase tracking-wider text-forest-2">
                          {c.icon} {c.label}
                        </span>
                        <p className="truncate text-sm font-medium">{f.location}</p>
                        <p className="text-xs text-muted-foreground">Planted {formatDate(f.planting_date)}</p>
                      </button>
                      <button
                        onClick={() => void deleteField(f.id)}
                        aria-label={`Delete ${f.location}`}
                        className="rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent"
                      >
                        ✕
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        <p className="eyebrow">Field entry</p>
        <h3 className="mt-1 text-xl font-semibold">Check your field</h3>

        <label htmlFor="cropSelect" className="mt-4 block text-sm font-medium">
          Crop
        </label>
        <select
          id="cropSelect"
          value={cropKey}
          onChange={(e) => setCropKey(e.target.value)}
          className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-ring"
        >
          {grouped.map((g) => (
            <optgroup key={g.family} label={g.family}>
              {g.items.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.icon} {c.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <p className="mt-1.5 text-xs text-muted-foreground">
          {crop.seasonDays}-day typical season · water buffer {crop.taw}mm
        </p>

        <label htmlFor="location" className="mt-4 block text-sm font-medium">
          Field location
        </label>
        <input
          id="location"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="e.g. Lahore, Pakistan"
          className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-ring"
        />

        <label htmlFor="plantingDate" className="mt-4 block text-sm font-medium">
          Planting date <span className="font-normal text-muted-foreground">(past or future)</span>
        </label>
        <input
          id="plantingDate"
          type="date"
          value={plantingDate}
          max={localISODate(new Date(Date.now() + 400 * 86400000))}
          onChange={(e) => setPlantingDate(e.target.value)}
          className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-ring"
        />

        <button
          onClick={() => void run(cropKey, location, plantingDate)}
          disabled={loading}
          className="mt-5 w-full rounded-xl bg-primary px-4 py-3.5 text-sm font-semibold text-primary-foreground shadow-float transition-all hover:-translate-y-0.5 hover:opacity-95 disabled:translate-y-0 disabled:opacity-60"
        >
          {loading ? "Reading your field…" : "Check my field"}
        </button>


        {error && (
          <div className="mt-3 rounded-lg border border-danger-line bg-danger-bg px-3 py-2 text-xs text-danger-text">
            {error}
          </div>
        )}

        {analysis && (
          <div className="mt-3 rounded-lg border border-border bg-card px-3 py-2 text-xs">
            {session ? (
              saveNote ? (
                <span className="text-muted-foreground">{saveNote}</span>
              ) : (
                <span className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Save this field for next time?</span>
                  <button onClick={() => void saveField()} className="font-semibold text-forest-2 underline">
                    Save
                  </button>
                </span>
              )
            ) : (
              <span className="text-muted-foreground">Sign in above to save this field.</span>
            )}
          </div>
        )}
      </div>

      {/* ---------------- Right: results ---------------- */}
      <div className="p-6 lg:p-8">
        {loading ? (
          <div className="space-y-5">
            <div className="h-6 w-40 overflow-hidden rounded-full bg-secondary skeleton-sheen" />
            <div className="h-32 overflow-hidden rounded-2xl bg-secondary skeleton-sheen" />
            <div className="grid gap-3 sm:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-24 overflow-hidden rounded-2xl bg-secondary skeleton-sheen" />
              ))}
            </div>
            <div className="h-40 overflow-hidden rounded-2xl bg-secondary skeleton-sheen" />
          </div>
        ) : !analysis ? (
          <div className="relative flex h-full min-h-[420px] flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed border-border bg-linear-to-b from-secondary/40 to-transparent p-8 text-center">
            <span className="animate-float-slow text-5xl">🌱</span>
            <p className="mt-5 font-display text-lg font-semibold">Your field read appears here</p>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
              Growth stage, soil-water balance, weather alerts and care notes — built from live weather for your exact
              location.
            </p>
          </div>
        ) : (
          <div className="reveal-on-load space-y-8">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider ${
                    analysis.planning ? "bg-surplus-bg text-surplus-text" : "bg-forest text-primary-foreground"
                  }`}
                >
                  {analysis.planning ? "Planning mode" : "Live field status"}
                </span>
                <span className="rounded-full bg-secondary px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-forest-2">
                  {analysis.crop.icon} {analysis.crop.label}
                </span>
                {!analysis.planning && (
                  <span className="rounded-full bg-secondary px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    {analysis.gddBased ? "Heat-unit tracking" : "Calendar estimate"}
                  </span>
                )}
              </div>
              <h3 className="mt-3 font-display text-3xl font-bold leading-tight">{analysis.place.name}</h3>
              <p className="mt-1 font-mono text-sm text-muted-foreground">
                {analysis.planning
                  ? `Planting in ${Math.abs(analysis.daysSincePlanting)} day${Math.abs(analysis.daysSincePlanting) === 1 ? "" : "s"} — ${formatDate(analysis.plantingDate)}`
                  : analysis.progress >= 1
                    ? `Day ${analysis.daysSincePlanting} since planting · at or past harvest maturity`
                    : `Day ${analysis.daysSincePlanting} since planting · ${Math.round(analysis.progress * 100)}% through the season`}
              </p>

            </div>


            <SeasonArc crop={analysis.crop} progress={analysis.planning ? null : analysis.progress} />

            {analysis.rec ? (
              <div className={`rounded-2xl border p-5 shadow-card ${toneStyles[analysis.rec.tone]}`}>
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] opacity-70">The call</p>
                <p className="mt-2 font-display text-xl font-bold leading-snug">{analysis.rec.title}</p>
                <p className="mt-2 text-sm leading-relaxed opacity-90">{analysis.rec.text}</p>
                {analysis.rec.subtext && <p className="mt-2 text-xs opacity-80">{analysis.rec.subtext}</p>}
              </div>

            ) : (
              <div className="rounded-2xl border border-border bg-secondary p-4">
                <p className="text-sm font-semibold">You haven't planted yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Here's the season ahead for {analysis.crop.label.toLowerCase()}. Live water balance and alerts start on
                  your planting date.
                </p>
              </div>
            )}

            {analysis.alerts.length > 0 && (
              <div className="space-y-2">
                {analysis.alerts.map((a, i) => (
                  <div
                    key={i}
                    className={`rounded-xl border px-3.5 py-2.5 text-xs ${
                      a.kind === "wet" ? "border-surplus-line bg-surplus-bg text-surplus-text" : "border-danger-line bg-danger-bg text-danger-text"
                    }`}
                  >
                    <strong className="font-semibold">
                      {a.kind === "frost" ? "Frost " : a.kind === "heat" ? "Heat " : "Wet weather "}
                    </strong>
                    {a.text}
                  </div>
                ))}
              </div>
            )}

            {!analysis.planning && (
              <>
                <section>
                  <p className="eyebrow">Current growth stage</p>
                  <p className="mt-1.5 text-lg font-semibold">{analysis.stage.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{analysis.stage.desc}</p>
                  {analysis.stage.critical && (
                    <p className="mt-2 inline-block rounded-md bg-danger-bg px-2 py-1 text-xs font-medium text-danger-text">
                      Yield-critical stage — protect water supply here first
                    </p>
                  )}
                </section>

                <section>
                  <p className="eyebrow">Growing conditions</p>
                  <div className="mt-2 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-border bg-linear-to-b from-secondary/70 to-card p-4 transition-shadow hover:shadow-card">
                      <p className="eyebrow">Sunlight (7-day)</p>
                      <p className="mt-1 text-base font-semibold">
                        {analysis.avgSolar >= 18 ? "High" : analysis.avgSolar >= 9 ? "Moderate" : "Low"}
                      </p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {analysis.avgSolar.toFixed(1)} MJ/m²/day
                      </p>
                    </div>
                    <div className="rounded-2xl border border-border bg-linear-to-b from-secondary/70 to-card p-4 transition-shadow hover:shadow-card">
                      <p className="eyebrow">Growth pace</p>
                      <p className="mt-1 text-base font-semibold">{paceLabel}</p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {analysis.avgDailyGdd7.toFixed(1)} GDD/day
                        {analysis.gddBased
                          ? ` · ${Math.round(analysis.accumulatedGdd)} of ${analysis.crop.gddTotal} total`
                          : ""}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-border bg-linear-to-b from-secondary/70 to-card p-4 transition-shadow hover:shadow-card">
                      <p className="eyebrow">Projected harvest</p>
                      <p className="mt-1 text-base font-semibold">
                        {formatDate(analysis.plantingDate, analysis.projectedHarvestDay)}
                      </p>
                      <p className="font-mono text-xs text-muted-foreground">
                        day {analysis.projectedHarvestDay} at current pace
                      </p>
                    </div>
                  </div>
                </section>

                {analysis.wb && (
                  <section>
                    <p className="eyebrow">Soil water balance</p>
                    <div className="mt-2 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-2xl border border-border bg-linear-to-b from-secondary/70 to-card p-4 text-center transition-shadow hover:shadow-card">
                        <p className="font-mono text-xl font-semibold">{Math.round(analysis.wb.past7Rain)}mm</p>
                        <p className="eyebrow mt-0.5">Rain, 7 days</p>
                      </div>
                      <div className="rounded-2xl border border-border bg-linear-to-b from-secondary/70 to-card p-4 text-center transition-shadow hover:shadow-card">
                        <p className="font-mono text-xl font-semibold">{Math.round(analysis.wb.past7Etc)}mm</p>
                        <p className="eyebrow mt-0.5">Crop use, 7 days</p>
                      </div>
                      <div className="rounded-2xl border border-border bg-linear-to-b from-secondary/70 to-card p-4 text-center transition-shadow hover:shadow-card">
                        <p className="font-mono text-xl font-semibold">{Math.round(analysis.wb.depletionPct)}%</p>
                        <p className="eyebrow mt-0.5">Root zone depleted</p>
                      </div>
                    </div>
                    <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full bg-linear-to-r from-forest-2 to-sun"
                        style={{ width: `${Math.min(100, Math.max(2, analysis.wb.depletionPct))}%` }}
                      />
                    </div>
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      Stress point for {analysis.crop.label.toLowerCase()} is{" "}
                      {Math.round(analysis.crop.depletionTrigger * 100)}% depletion (
                      {Math.round(analysis.crop.taw * analysis.crop.depletionTrigger)}mm of the {analysis.crop.taw}mm
                      root-zone buffer).
                    </p>
                    <div className="mt-4">
                      <BalanceChart series={analysis.wb.series} />
                    </div>
                  </section>
                )}
              </>
            )}

            <SatellitePanel
              latitude={analysis.place.latitude}
              longitude={analysis.place.longitude}
              placeName={analysis.place.name}
            />

            <ProtectionPanel
              crop={analysis.crop}
              stageName={analysis.planning ? null : analysis.stage.name}
              spray={analysis.spray}
              latitude={analysis.place.latitude}
              longitude={analysis.place.longitude}
            />




            <section>
              <p className="eyebrow">Crop care notes</p>
              <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Common pests</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {analysis.crop.pests.map((p) => (
                  <span key={p} className="rounded-full bg-secondary px-2.5 py-1 text-xs">
                    {p}
                  </span>
                ))}
              </div>
              <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Common diseases
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {analysis.crop.diseases.map((d) => (
                  <span key={d} className="rounded-full bg-secondary px-2.5 py-1 text-xs">
                    {d}
                  </span>
                ))}
              </div>
              <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Care tips</p>
              <ul className="mt-1.5 space-y-1.5 text-sm text-muted-foreground">
                {analysis.crop.tips.map((t) => (
                  <li key={t} className="flex gap-2">
                    <span className="text-forest-2">•</span>
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-muted-foreground">
                General agronomic guidance. Pesticide options, thresholds and dose maths are in the crop protection
                section above.
              </p>
            </section>

            <section>
              <p className="eyebrow">Full season timeline</p>
              <ol className="mt-3 space-y-4">
                {stageWindows(analysis.crop).map((w) => {
                  const current = !analysis.planning && w.name === analysis.stage.name;
                  return (
                    <li key={w.name} className="flex gap-3">
                      <div className="mt-1.5 flex flex-col items-center">
                        <span
                          className={`h-2.5 w-2.5 rounded-full ${
                            current ? "bg-sun ring-4 ring-sun/25" : w.critical ? "bg-sun-deep" : "bg-forest-2"
                          }`}
                        />
                        <span className="mt-1 w-px flex-1 bg-border" />
                      </div>
                      <div className="pb-1">
                        <p className="text-sm font-semibold">
                          {w.name}
                          {w.critical && <span className="ml-1.5 text-xs text-danger-text">critical</span>}
                        </p>
                        <p className="font-mono text-xs text-muted-foreground">
                          {formatDate(analysis.plantingDate, w.startDay)} · day {w.startDay}–{w.endDay}
                        </p>
                        <p className="mt-0.5 text-sm text-muted-foreground">{w.desc}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>

            <p className="border-t border-border pt-4 text-xs text-muted-foreground">
              {analysis.crop.caveat} Growth stage is tracked with accumulated heat units (growing degree days) and water
              with a simplified FAO-56 root-zone balance on real weather data — a solid indicative estimate, not a
              certified agronomic measurement. For critical decisions, consult a local advisor.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
