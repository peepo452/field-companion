import type { WaterBalance } from "@/lib/agronomy";

export function BalanceChart({ series }: { series: WaterBalance["series"] }) {
  const w = 400;
  const h = 96;
  const gap = 2;
  const barW = series.length ? (w - (series.length - 1) * gap) / series.length : 0;
  const maxAbs = Math.max(6, ...series.map((d) => Math.abs(d.rain - d.etc)));
  const mid = h / 2;

  const linePts = series
    .map((d, i) => {
      const x = i * (barW + gap) + barW / 2;
      const y = h - (d.depletionPct / 100) * (h - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const todayIdx = series.findIndex((d) => d.isFuture);
  const todayX = todayIdx > 0 ? todayIdx * (barW + gap) - gap / 2 : null;

  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-auto w-full">
        <line x1="0" y1={mid} x2={w} y2={mid} stroke="var(--color-line)" strokeWidth="1" />
        {series.map((d, i) => {
          const net = d.rain - d.etc;
          const barH = (Math.abs(net) / maxAbs) * (h / 2 - 6);
          const deficit = net < 0;
          return (
            <rect
              key={i}
              x={i * (barW + gap)}
              y={deficit ? mid : mid - barH}
              width={barW}
              height={barH}
              rx="1.5"
              fill={deficit ? "var(--color-danger-line)" : d.isFuture ? "var(--color-sky)" : "var(--color-forest-2)"}
              opacity={d.isFuture ? 0.5 : 0.85}
            />
          );
        })}
        {todayX != null && (
          <line
            x1={todayX}
            y1="0"
            x2={todayX}
            y2={h}
            stroke="var(--color-sun-deep)"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
        )}
        <polyline points={linePts} fill="none" stroke="var(--color-forest)" strokeWidth="1.6" opacity="0.75" />
      </svg>
      <div className="mt-1 flex justify-between eyebrow">
        <span>Past 10 days</span>
        <span>Today</span>
        <span>Next 16 days</span>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Bars show each day's rain minus crop water use — green/blue above the line is surplus, red below is deficit. The
        dark line traces how depleted the root zone gets.
      </p>
    </div>
  );
}
