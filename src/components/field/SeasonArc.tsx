import type { Crop } from "@/lib/crops";
import { stageWindows } from "@/lib/agronomy";

type Props = {
  crop: Crop;
  /** 0-1 through the season, or null when the crop isn't planted yet. */
  progress: number | null;
};

function pointAt(t: number) {
  const p0 = { x: 22, y: 118 };
  const p1 = { x: 200, y: 2 };
  const p2 = { x: 378, y: 118 };
  const x = (1 - t) * (1 - t) * p0.x + 2 * (1 - t) * t * p1.x + t * t * p2.x;
  const y = (1 - t) * (1 - t) * p0.y + 2 * (1 - t) * t * p1.y + t * t * p2.y;
  return { x, y };
}

export function SeasonArc({ crop, progress }: Props) {
  const windows = stageWindows(crop);
  const t = progress == null ? null : Math.max(0, Math.min(1, progress));

  return (
    <div className="mt-1">
      <svg viewBox="0 0 400 148" className="h-auto w-full overflow-visible">
        <path
          d="M22,118 Q200,2 378,118"
          fill="none"
          stroke="var(--color-line)"
          strokeWidth="2"
          strokeDasharray="1 6"
          strokeLinecap="round"
        />
        {windows.map((w, i) => {
          const p = pointAt(w.startFrac);
          const above = i % 2 === 0;
          return (
            <g key={w.name}>
              <circle
                cx={p.x}
                cy={p.y}
                r={w.critical ? 4.5 : 3.5}
                fill={w.critical ? "var(--color-sun)" : "var(--color-forest-2)"}
              />
              <text
                x={p.x}
                y={above ? p.y - 10 : p.y + 16}
                textAnchor="middle"
                fontSize="8.5"
                fill="var(--color-muted-foreground)"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {w.name.split(" ")[0]}
              </text>
            </g>
          );
        })}
        {t != null && (
          <g>
            <circle cx={pointAt(t).x} cy={pointAt(t).y} r="11" fill="var(--color-sun)" opacity="0.22" />
            <circle
              cx={pointAt(t).x}
              cy={pointAt(t).y}
              r="6"
              fill="var(--color-sun)"
              stroke="var(--color-card)"
              strokeWidth="2"
            />
          </g>
        )}
      </svg>
      <div className="mt-1 flex justify-between eyebrow">
        <span>Planting</span>
        <span>Harvest</span>
      </div>
    </div>
  );
}
