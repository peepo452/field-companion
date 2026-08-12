import { useEffect, useMemo, useState } from "react";
import {
  AREA_UNITS,
  computeDose,
  fmtAmount,
  fmtVolume,
  fmtWater,
  getProtection,
  type Product,
  type SprayWindow,
  type Threat,
} from "@/lib/protection";
import {
  jurisdictionLabel,
  knownCountries,
  manualJurisdiction,
  regimeFor,
  resolveJurisdiction,
  rulingFor,
  STATUS_META,
  subdivisionsWithRules,
  type Jurisdiction,
  type RegStatus,
  type Ruling,
} from "@/lib/regulatory";
import type { Crop } from "@/lib/crops";

const catStyle: Record<string, string> = {
  insecticide: "bg-danger-bg text-danger-text border-danger-line",
  fungicide: "bg-surplus-bg text-surplus-text border-surplus-line",
  herbicide: "bg-secondary text-foreground border-border",
  biological: "bg-forest-light text-forest-2 border-forest-2/30",
};

const statusStyle: Record<RegStatus, string> = {
  approved: "bg-forest-light text-forest-2 border-forest-2/30",
  restricted: "bg-surplus-bg text-surplus-text border-surplus-line",
  banned: "bg-danger-bg text-danger-text border-danger-line",
  unregistered: "bg-danger-bg text-danger-text border-danger-line",
};

const hazardLabel: Record<string, string> = {
  Ia: "WHO Ia · extremely hazardous",
  Ib: "WHO Ib · highly hazardous",
  II: "WHO II · moderately hazardous",
  III: "WHO III · slightly hazardous",
  U: "WHO U · unlikely to be hazardous",
};


function ProductRow({
  p,
  hectares,
  waterLPerHa,
}: {
  p: Product;
  hectares: number;
  waterLPerHa: [number, number];
}) {
  const [strength, setStrength] = useState(200);
  const dose = useMemo(() => computeDose(p, waterLPerHa, hectares, strength), [p, hectares, waterLPerHa, strength]);

  return (
    <div className="rounded-xl border border-border bg-card p-3.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-snug">{p.ai}</p>
          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {p.moa} · {p.gAiPerHa[0]}–{p.gAiPerHa[1]} g a.i./ha
          </p>
        </div>
        <span className={`shrink-0 rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${catStyle[p.category]}`}>
          {p.category}
        </span>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <div className="rounded-lg bg-secondary/60 px-2.5 py-2">
          <p className="eyebrow">Active needed</p>
          <p className="font-mono text-sm font-semibold">
            {fmtAmount(dose.aiGrams[0])} – {fmtAmount(dose.aiGrams[1])}
          </p>
        </div>
        <div className="rounded-lg bg-secondary/60 px-2.5 py-2">
          <p className="eyebrow">Product at {strength} g/L</p>
          <p className="font-mono text-sm font-semibold">
            {fmtVolume(dose.productAmount[0])} – {fmtVolume(dose.productAmount[1])}
          </p>
        </div>
        <div className="rounded-lg bg-secondary/60 px-2.5 py-2">
          <p className="eyebrow">Spray water</p>
          <p className="font-mono text-sm font-semibold">
            {fmtWater(dose.waterL[0])} – {fmtWater(dose.waterL[1])}
          </p>
        </div>
      </div>

      <label className="mt-3 block text-xs text-muted-foreground">
        Strength printed on your container (g of active per litre or kg)
        <input
          type="number"
          min={1}
          value={strength}
          onChange={(e) => setStrength(Math.max(1, Number(e.target.value) || 1))}
          className="mt-1 w-28 rounded-md border border-input bg-background px-2 py-1 font-mono text-xs outline-none focus:border-ring"
        />
      </label>

      <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
        <span className="rounded-md bg-secondary px-2 py-0.5">
          Harvest after <strong>{p.phi}d</strong>
        </span>
        <span className="rounded-md bg-secondary px-2 py-0.5">
          Re-enter after <strong>{p.rei}h</strong>
        </span>
        <span className="rounded-md bg-secondary px-2 py-0.5">{hazardLabel[p.hazard]}</span>
        <span
          className={`rounded-md px-2 py-0.5 ${
            p.beeRisk === "high" ? "bg-danger-bg text-danger-text" : p.beeRisk === "moderate" ? "bg-surplus-bg text-surplus-text" : "bg-forest-light text-forest-2"
          }`}
        >
          Bees: {p.beeRisk} risk
        </span>
      </div>
      {p.note && <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{p.note}</p>}
    </div>
  );
}

function ThreatCard({
  t,
  active,
  hectares,
  waterLPerHa,
}: {
  t: Threat;
  active: boolean;
  hectares: number;
  waterLPerHa: [number, number];
}) {
  const [open, setOpen] = useState(active);

  return (
    <div
      className={`overflow-hidden rounded-2xl border transition-shadow ${
        active ? "border-forest-2/50 bg-linear-to-b from-forest-light/60 to-card shadow-card" : "border-border bg-card"
      }`}
    >
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-start gap-3 p-4 text-left">
        <span className="mt-0.5 text-lg">{t.kind === "insect" ? "🐛" : t.kind === "disease" ? "🍂" : "🌿"}</span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{t.name}</span>
            {active && (
              <span className="rounded-full bg-forest px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-primary-foreground">
                Active now
              </span>
            )}
          </span>
          <span className="mt-1 block text-xs text-muted-foreground">Risk window: {t.stages.join(" · ")}</span>
        </span>
        <span className="shrink-0 text-muted-foreground">{open ? "−" : "+"}</span>
      </button>

      {open && (
        <div className="space-y-3 border-t border-border px-4 pb-4 pt-3">
          <div>
            <p className="eyebrow">1 · Scout before you spray</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{t.scouting}</p>
          </div>
          <div className="rounded-xl border border-sun/40 bg-sun/10 px-3.5 py-2.5">
            <p className="eyebrow">2 · Action threshold</p>
            <p className="mt-1 text-sm font-medium leading-relaxed">{t.threshold}</p>
          </div>
          {t.trigger && (
            <div>
              <p className="eyebrow">Weather that brings it on</p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{t.trigger}</p>
            </div>
          )}
          <div>
            <p className="eyebrow">3 · Try this first (no chemical)</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{t.cultural}</p>
          </div>
          <div>
            <p className="eyebrow">4 · If the threshold is met — rotate between these</p>
            <div className="mt-2 space-y-2">
              {t.products.map((p) => (
                <ProductRow key={p.ai} p={p} hectares={hectares} waterLPerHa={waterLPerHa} />
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Never use the same group code twice in a row against the same pest generation — that is how resistance
              starts.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export function ProtectionPanel({
  crop,
  stageName,
  spray,
}: {
  crop: Crop;
  stageName: string | null;
  spray: SprayWindow | null;
}) {
  const prot = getProtection(crop.key);
  const [area, setArea] = useState(1);
  const [unitKey, setUnitKey] = useState("acre");

  const unit = AREA_UNITS.find((u) => u.key === unitKey) ?? AREA_UNITS[1]!;
  const hectares = (area * unit.m2) / 10000;

  if (!prot) {
    return (
      <section>
        <p className="eyebrow">Crop protection</p>
        <p className="mt-2 text-sm text-muted-foreground">
          A threshold-based protection programme for {crop.label.toLowerCase()} isn't in the library yet. Follow your
          national extension service's recommendation for this crop.
        </p>
      </section>
    );
  }

  const active = prot.threats.filter((t) => stageName && t.stages.includes(stageName));
  const later = prot.threats.filter((t) => !active.includes(t));

  const verdictStyle =
    spray?.verdict === "hold"
      ? "border-danger-line bg-danger-bg text-danger-text"
      : spray?.verdict === "marginal"
        ? "border-surplus-line bg-surplus-bg text-surplus-text"
        : "border-forest-2/40 bg-forest-light text-forest-2";

  return (
    <section>
      <p className="eyebrow">Crop protection</p>
      <h4 className="mt-1 font-display text-2xl font-bold leading-tight">Pesticide plan for this field</h4>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
        Threshold-first guidance built on FAO/WHO and IRAC/FRAC international practice. Scout, compare against the
        threshold, and only then spray — with the exact quantity for your land size.
      </p>

      {spray && (
        <div className={`mt-4 rounded-2xl border p-4 shadow-card ${verdictStyle}`}>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] opacity-70">Spray window</p>
          <p className="mt-1.5 font-display text-lg font-bold">{spray.headline}</p>
          <ul className="mt-2 space-y-1 text-sm leading-relaxed opacity-90">
            {spray.reasons.map((r) => (
              <li key={r} className="flex gap-2">
                <span>•</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs font-medium opacity-80">{spray.bestDayLabel}</p>
        </div>
      )}

      {/* land size */}
      <div className="mt-4 rounded-2xl border border-border bg-linear-to-b from-secondary/60 to-card p-4">
        <p className="eyebrow">Your land size</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            type="number"
            min={0.01}
            step="0.25"
            value={area}
            onChange={(e) => setArea(Math.max(0.01, Number(e.target.value) || 0.01))}
            className="w-24 rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm outline-none focus:border-ring"
          />
          <select
            value={unitKey}
            onChange={(e) => setUnitKey(e.target.value)}
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
          >
            {AREA_UNITS.map((u) => (
              <option key={u.key} value={u.key}>
                {u.label}
              </option>
            ))}
          </select>
          <span className="font-mono text-xs text-muted-foreground">
            = {hectares.toFixed(3)} ha · {(hectares * 2.47105).toFixed(2)} acre
          </span>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Every dose below is recalculated for this area, at {prot.waterLPerHa[0]}–{prot.waterLPerHa[1]} L of spray water
          per hectare for {crop.label.toLowerCase()}.
        </p>
      </div>

      {active.length > 0 && (
        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Watch now — {stageName}
          </p>
          <div className="mt-2 space-y-3">
            {active.map((t) => (
              <ThreatCard key={t.name} t={t} active hectares={hectares} waterLPerHa={prot.waterLPerHa} />
            ))}
          </div>
        </div>
      )}

      {later.length > 0 && (
        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {active.length ? "Other threats this season" : "Threats across the season"}
          </p>
          <div className="mt-2 space-y-3">
            {later.map((t) => (
              <ThreatCard key={t.name} t={t} active={false} hectares={hectares} waterLPerHa={prot.waterLPerHa} />
            ))}
          </div>
        </div>
      )}

      <div className="mt-5 rounded-2xl border border-border bg-secondary/50 p-4">
        <p className="eyebrow">Safe use — non-negotiable</p>
        <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-muted-foreground">
          <li className="flex gap-2"><span className="text-forest-2">•</span><span>Wear coveralls, nitrile gloves, goggles and a respirator when mixing — mixing concentrate is the highest-exposure moment, not spraying.</span></li>
          <li className="flex gap-2"><span className="text-forest-2">•</span><span>Spray in low wind (3-10 km/h), never in dead calm at dawn (inversion) or above 15 km/h (drift).</span></li>
          <li className="flex gap-2"><span className="text-forest-2">•</span><span>Keep a 10 m unsprayed buffer from any watercourse, well, pond or housing.</span></li>
          <li className="flex gap-2"><span className="text-forest-2">•</span><span>Calibrate the sprayer before the season: spray water over a measured 100 m² and scale up. A guessed rate is the most common cause of both failure and residue violations.</span></li>
          <li className="flex gap-2"><span className="text-forest-2">•</span><span>Triple-rinse containers into the tank, then puncture them. Never reuse a pesticide container.</span></li>
          <li className="flex gap-2"><span className="text-forest-2">•</span><span>Respect the pre-harvest interval exactly — it is what keeps your produce inside Codex/EU residue limits.</span></li>
          <li className="flex gap-2"><span className="text-forest-2">•</span><span>Write down date, product, rate, area and weather after every spray. Buyers and auditors ask for it.</span></li>
        </ul>
        {prot.notes.map((n) => (
          <p key={n} className="mt-2.5 text-xs leading-relaxed text-muted-foreground">
            <strong className="font-semibold text-foreground">{crop.label}: </strong>
            {n}
          </p>
        ))}
      </div>

      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        Rates are internationally published active-ingredient ranges for guidance and planning. Pesticide registration,
        legal rates and permitted crops differ by country — always read and follow the product label and confirm
        registration with your local plant-protection authority or extension officer before applying.
      </p>
    </section>
  );
}
