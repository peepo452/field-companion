import { createFileRoute } from "@tanstack/react-router";
import { Droplets, Sprout, ShieldAlert, Satellite, Thermometer, LineChart } from "lucide-react";
import { FieldConsole } from "@/components/field/FieldConsole";
import { CROPS } from "@/lib/crops";
import heroField from "@/assets/hero-field.jpg";
import soilMacro from "@/assets/soil-macro.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Field Assistant — Crop Growth Stage & Irrigation Timing" },
      {
        name: "description",
        content:
          "Track your crop's growth stage with heat units, see a real soil-water balance from live weather, and know when to irrigate. 14 crops, free.",
      },
      { property: "og:title", content: "Field Assistant — Crop Growth Stage & Irrigation Timing" },
      {
        property: "og:description",
        content:
          "Growth stage tracking, irrigation timing and pest notes for 14 crops, built on real weather data and an FAO-56 water balance.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const features = [
  {
    icon: Droplets,
    title: "When to water",
    body: "A carried-forward root-zone water balance, not a flat rainfall rule — so a dry spell after heavy rain is handled correctly.",
  },
  {
    icon: Sprout,
    title: "Where you stand",
    body: "Growth stage from accumulated heat units, so a cold season shows up as a late season instead of a wrong date.",
  },
  {
    icon: ShieldAlert,
    title: "What to watch for",
    body: "Frost and heat alerts tied to the stages that are actually sensitive, plus pest and disease notes per crop.",
  },
];

const steps = [
  {
    icon: Satellite,
    label: "01",
    title: "Locate the field",
    body: "Type any town or village. We resolve the coordinates and pull the live weather record for that exact spot.",
  },
  {
    icon: Thermometer,
    label: "02",
    title: "Accumulate the heat",
    body: "Every day since planting is scored in growing degree days against your crop's own thresholds.",
  },
  {
    icon: LineChart,
    label: "03",
    title: "Read the decision",
    body: "Rain in, crop water use out, day by day — ending in one plain answer about irrigating today.",
  },
];

const stats = [
  { value: "14", label: "Crops modelled" },
  { value: "16d", label: "Forecast horizon" },
  { value: "FAO-56", label: "Water balance" },
  { value: "Free", label: "No account needed" },
];

function Index() {
  return (
    <main className="min-h-screen bg-background">
      {/* ---------------- Cinematic hero ---------------- */}
      <section className="relative isolate overflow-hidden">
        <img
          src={heroField}
          alt="Aerial view of crop rows at sunrise"
          width={1920}
          height={1200}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="hero-vignette noise absolute inset-0" />

        <div className="relative mx-auto max-w-6xl px-6">
          <header className="flex items-center justify-between py-6">
            <div className="flex items-center gap-2.5">
              <span className="glass-dark grid h-10 w-10 place-items-center rounded-xl text-base">🌾</span>
              <span className="font-display text-lg font-bold text-white">Field Assistant</span>
            </div>
            <a
              href="#tool"
              className="glass-dark rounded-full px-4 py-2 font-mono text-[11px] uppercase tracking-wider text-white/85 transition-colors hover:text-white"
            >
              Open the console
            </a>
          </header>

          <div className="reveal-on-load grid gap-12 pb-24 pt-16 lg:grid-cols-[1.05fr_0.95fr] lg:pb-32 lg:pt-24">
            <div>
              <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-sun">
                <span className="h-1.5 w-1.5 rounded-full bg-sun shadow-glow" />
                Live weather · 14 crops
              </p>
              <h1 className="mt-5 font-display text-[2.6rem] font-bold leading-[1.03] text-white sm:text-6xl">
                Know your field's{" "}
                <span className="text-gradient">next move</span>, before you make it.
              </h1>
              <p className="mt-6 max-w-xl text-base leading-relaxed text-white/75 sm:text-lg">
                Pick your crop and planting date. Field Assistant pulls live weather for your location, tracks growth by
                heat units, models the water left in your root zone, and tells you plainly whether to irrigate today.
              </p>
              <div className="mt-9 flex flex-wrap items-center gap-3">
                <a
                  href="#tool"
                  className="group inline-flex items-center gap-2 rounded-xl bg-sun px-6 py-3.5 text-sm font-semibold text-forest shadow-glow transition-transform hover:-translate-y-0.5"
                >
                  Check my field
                  <span className="transition-transform group-hover:translate-y-0.5">↓</span>
                </a>
                <a
                  href="#how"
                  className="glass-dark inline-flex items-center gap-2 rounded-xl px-6 py-3.5 text-sm font-semibold text-white/90 transition-colors hover:text-white"
                >
                  How it works
                </a>
              </div>

              <dl className="mt-12 grid max-w-lg grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-4">
                {stats.map((s) => (
                  <div key={s.label}>
                    <dt className="font-display text-2xl font-bold text-white">{s.value}</dt>
                    <dd className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-white/55">{s.label}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="hidden lg:block">
              <div className="glass-dark animate-float-slow rounded-3xl p-6">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-sun">Today's read</p>
                <p className="mt-3 font-display text-2xl font-bold text-white">Irrigate within 2 days</p>
                <p className="mt-2 text-sm text-white/70">
                  Root zone is 58% depleted and the next 5 days carry only 3mm of rain against 24mm of crop use.
                </p>
                <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/15">
                  <div className="h-full w-[58%] rounded-full bg-sun" />
                </div>
                <div className="mt-6 grid grid-cols-3 gap-3">
                  {[
                    ["Stage", "Tasselling"],
                    ["Heat units", "1,140"],
                    ["Pace", "On track"],
                  ].map(([k, v]) => (
                    <div key={k} className="rounded-xl bg-white/8 p-3">
                      <p className="font-mono text-[9px] uppercase tracking-wider text-white/50">{k}</p>
                      <p className="mt-1 text-sm font-semibold text-white">{v}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-4 font-mono text-[10px] uppercase tracking-wider text-white/40">
                  Illustrative example
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- Crop marquee ---------------- */}
      <section className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap justify-center gap-2 px-6 py-6">
          {CROPS.map((c) => (
            <span
              key={c.key}
              className="rounded-full border border-border bg-secondary/60 px-3 py-1.5 font-mono text-[11px] text-muted-foreground"
            >
              {c.icon} {c.label}
            </span>
          ))}
        </div>
      </section>

      {/* ---------------- Features ---------------- */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <p className="eyebrow text-center">How it helps</p>
          <h2 className="mx-auto mt-3 max-w-2xl text-center text-3xl font-bold sm:text-4xl">
            Three things every grower needs to know
          </h2>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {features.map((f) => (
              <div
                key={f.title}
                className="group surface relative overflow-hidden p-7 transition-all hover:-translate-y-1 hover:shadow-float"
              >
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-forest-light text-forest">
                  <f.icon className="h-5 w-5" strokeWidth={1.8} />
                </span>
                <h3 className="mt-5 font-display text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
                <span className="absolute -right-10 -top-10 h-24 w-24 rounded-full bg-sun/10 opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- How it works ---------------- */}
      <section id="how" className="scroll-mt-6 px-6 pb-20">
        <div className="mx-auto grid max-w-6xl items-center gap-10 overflow-hidden rounded-3xl border border-border bg-forest text-white lg:grid-cols-[0.9fr_1.1fr]">
          <div className="relative h-64 w-full lg:h-full lg:min-h-[420px]">
            <img
              src={soilMacro}
              alt="Close-up of a seedling emerging from dark soil"
              loading="lazy"
              width={1280}
              height={960}
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-linear-to-r from-transparent to-forest/90 lg:to-forest" />
          </div>
          <div className="px-7 pb-10 lg:py-12 lg:pr-12">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-sun">Under the hood</p>
            <h2 className="mt-3 font-display text-3xl font-bold sm:text-4xl">
              Real weather in, one clear decision out
            </h2>
            <ol className="mt-9 space-y-7">
              {steps.map((s) => (
                <li key={s.title} className="flex gap-4">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/10">
                    <s.icon className="h-5 w-5 text-sun" strokeWidth={1.8} />
                  </span>
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-wider text-white/45">{s.label}</p>
                    <p className="mt-0.5 font-display text-base font-semibold">{s.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-white/70">{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* ---------------- Console ---------------- */}
      <section id="tool" className="scroll-mt-6 px-6 pb-24">
        <div className="mx-auto max-w-6xl">
          <p className="eyebrow text-center">The console</p>
          <h2 className="mt-3 text-center text-3xl font-bold sm:text-4xl">Check your field</h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-sm text-muted-foreground">
            Two inputs, no sign-up. Sign in only if you want to keep your fields for next time.
          </p>
          <div className="mt-10">
            <FieldConsole />
          </div>
        </div>
      </section>

      <footer className="border-t border-border bg-card px-6 py-10">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-forest-light text-base">🌾</span>
            <span className="font-display text-sm font-bold">Field Assistant</span>
          </div>
          <p className="max-w-xl text-xs leading-relaxed text-muted-foreground">
            Weather and reference evapotranspiration from Open-Meteo. Growth and water models are simplified FAO-56
            style estimates for guidance, not certified agronomic advice.
          </p>
        </div>
      </footer>
    </main>
  );
}
