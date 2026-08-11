import { createFileRoute } from "@tanstack/react-router";
import { FieldConsole } from "@/components/field/FieldConsole";
import { CROPS } from "@/lib/crops";

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
    title: "When to water",
    body: "A carried-forward root-zone water balance, not a flat rainfall rule — so a dry spell after heavy rain is handled correctly.",
  },
  {
    title: "Where you stand",
    body: "Growth stage from accumulated heat units, so a cold season shows up as a late season instead of a wrong date.",
  },
  {
    title: "What to watch for",
    body: "Frost and heat alerts tied to the stages that are actually sensitive, plus pest and disease notes per crop.",
  },
];

function Index() {
  return (
    <main className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-forest text-base">🌾</span>
          <span className="font-display text-lg font-bold">Field Assistant</span>
        </div>
        <span className="rounded-full bg-forest-light px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-forest">
          Free tool
        </span>
      </header>

      <section className="relative overflow-hidden px-6 pb-16 pt-8">
        <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="eyebrow flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-sun" />
              Built for growers
            </p>
            <h1 className="mt-3 text-4xl font-bold leading-[1.08] sm:text-5xl">
              Know your field's <span className="text-forest-2">next move</span>, before you make it.
            </h1>
            <p className="mt-5 max-w-xl text-base text-muted-foreground">
              Pick your crop and planting date. Field Assistant pulls live weather for your location, tracks growth by
              heat units, models how much water is left in your root zone, and tells you plainly whether to irrigate
              today.
            </p>
            <a
              href="#tool"
              className="mt-7 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              Check my field ↓
            </a>
            <div className="mt-6 flex flex-wrap gap-1.5">
              {CROPS.map((c) => (
                <span
                  key={c.key}
                  className="rounded-full border border-border bg-card px-2.5 py-1 font-mono text-[11px] text-muted-foreground"
                >
                  {c.icon} {c.label}
                </span>
              ))}
            </div>
          </div>
          <div className="grain-field hidden aspect-[4/3] rounded-3xl border border-border bg-forest-light/60 lg:block" />
        </div>
      </section>

      <section className="px-6 pb-16">
        <div className="mx-auto max-w-6xl">
          <p className="eyebrow text-center">How it helps</p>
          <h2 className="mt-2 text-center text-2xl font-bold sm:text-3xl">Three things every grower needs to know</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {features.map((f) => (
              <div key={f.title} className="rounded-2xl border border-border bg-card p-6 shadow-card">
                <h3 className="text-base font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="tool" className="scroll-mt-6 px-6 pb-24">
        <div className="mx-auto max-w-6xl">
          <FieldConsole />
        </div>
      </section>

      <footer className="border-t border-border px-6 py-8">
        <p className="mx-auto max-w-6xl text-xs text-muted-foreground">
          Weather and reference evapotranspiration from Open-Meteo. Growth and water models are simplified FAO-56 style
          estimates for guidance, not certified agronomic advice.
        </p>
      </footer>
    </main>
  );
}
