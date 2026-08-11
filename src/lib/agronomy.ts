import type { Crop, Stage } from "./crops";

export type DailyWeather = {
  dates: string[];
  precip: number[];
  et0: number[];
  tmax: number[];
  tmin: number[];
  solar: number[];
  /** Index of today inside the arrays. */
  todayIdx: number;
  /** Number of past days actually returned before today. */
  pastDays: number;
};

export type StageWindow = Stage & { startDay: number; endDay: number };

/** Resolve a crop's fractional stage table into concrete day windows. */
export function stageWindows(crop: Crop): StageWindow[] {
  return crop.stages.map((s, i) => {
    const startDay = Math.round(s.startFrac * crop.seasonDays);
    const next = crop.stages[i + 1];
    const endDay = next ? Math.round(next.startFrac * crop.seasonDays) - 1 : crop.seasonDays;
    return { ...s, startDay, endDay };
  });
}

/** Stage for a given progress fraction of the season (0 = planting, 1 = harvest). */
export function stageForProgress(crop: Crop, progress: number): StageWindow {
  const windows = stageWindows(crop);
  const p = Math.max(0, Math.min(1, progress));
  let found = windows[0]!;
  for (const w of windows) if (p >= w.startFrac) found = w;
  return found;
}

export function stageForDay(crop: Crop, day: number): StageWindow {
  return stageForProgress(crop, Math.max(0, day) / crop.seasonDays);
}

/** Single-day growing degree days, with an upper cap on daytime heat. */
export function dailyGdd(crop: Crop, tmax: number | null, tmin: number | null): number {
  if (tmax == null || tmin == null) return 0;
  const hi = Math.min(tmax, crop.gddCap);
  const lo = Math.max(Math.min(tmin, crop.gddCap), crop.gddBase);
  return Math.max(0, (hi + Math.max(lo, crop.gddBase)) / 2 - crop.gddBase);
}

export type WaterBalance = {
  /** Root-zone depletion today, mm (0 = field capacity). */
  depletion: number;
  depletionPct: number;
  /** mm that would need to be applied to refill the root zone. */
  refillNeed: number;
  past7Rain: number;
  past7Etc: number;
  /** Days from today until depletion crosses the stress trigger, or null. */
  daysToStress: number | null;
  forecastRain16: number;
  /** Per-day series for the chart, past 10 days + forecast. */
  series: { rain: number; etc: number; isFuture: boolean; depletionPct: number }[];
};

/**
 * FAO-56 style single-coefficient root-zone water balance.
 * Depletion is carried forward day to day instead of summing a naive 7-day
 * window, so a long dry spell after heavy rain is handled correctly.
 */
export function waterBalance(
  crop: Crop,
  w: DailyWeather,
  daysSincePlanting: number,
  progressAt: (dayOffset: number) => number,
): WaterBalance {
  const { todayIdx } = w;
  const startIdx = Math.max(0, todayIdx - Math.min(w.pastDays, 40));

  const kcAt = (idx: number) => {
    const dayOffset = daysSincePlanting + (idx - todayIdx);
    if (dayOffset < 0) return 0;
    return stageForProgress(crop, progressAt(dayOffset)).kc;
  };
  const etcAt = (idx: number) => (w.et0[idx] ?? 0) * kcAt(idx);
  // Runoff/deep-percolation allowance: not all rainfall reaches the root zone.
  const effRain = (idx: number) => Math.min((w.precip[idx] ?? 0) * 0.85, 45);

  // Warm the model up from a half-depleted profile at the start of the window.
  let depletion = crop.taw * 0.25;
  for (let i = startIdx; i <= todayIdx; i++) {
    depletion = Math.min(crop.taw, Math.max(0, depletion + etcAt(i) - effRain(i)));
  }
  const depletionToday = depletion;

  let past7Rain = 0;
  let past7Etc = 0;
  for (let i = Math.max(0, todayIdx - 7); i < todayIdx; i++) {
    past7Rain += w.precip[i] ?? 0;
    past7Etc += etcAt(i);
  }

  const trigger = crop.taw * crop.depletionTrigger;
  let daysToStress: number | null = depletionToday >= trigger ? 0 : null;
  let future = depletionToday;
  let forecastRain16 = 0;
  for (let i = todayIdx + 1; i < w.dates.length; i++) {
    future = Math.min(crop.taw, Math.max(0, future + etcAt(i) - effRain(i)));
    forecastRain16 += w.precip[i] ?? 0;
    if (daysToStress === null && future >= trigger) daysToStress = i - todayIdx;
  }

  const series: WaterBalance["series"] = [];
  let d = crop.taw * 0.25;
  const chartStart = Math.max(0, todayIdx - 10);
  for (let i = startIdx; i < w.dates.length; i++) {
    d = Math.min(crop.taw, Math.max(0, d + etcAt(i) - effRain(i)));
    if (i >= chartStart) {
      series.push({
        rain: w.precip[i] ?? 0,
        etc: etcAt(i),
        isFuture: i > todayIdx,
        depletionPct: (d / crop.taw) * 100,
      });
    }
  }

  return {
    depletion: depletionToday,
    depletionPct: (depletionToday / crop.taw) * 100,
    refillNeed: Math.round(depletionToday),
    past7Rain,
    past7Etc,
    daysToStress,
    forecastRain16,
    series,
  };
}

export type Progress = {
  /** 0-1 through the season. */
  progress: number;
  /** True when GDD history covered the whole time since planting. */
  gddBased: boolean;
  accumulatedGdd: number;
  avgDailyGdd7: number;
  /** Ratio of observed pace to the pace implied by a calendar-average season. */
  paceRatio: number;
  projectedHarvestDay: number;
  progressAt: (dayOffset: number) => number;
};

/**
 * Growth progress driven by accumulated heat units rather than the calendar.
 * A cold season genuinely runs later than the calendar suggests, which is the
 * whole point of tracking GDD.
 */
export function growthProgress(crop: Crop, w: DailyWeather, daysSincePlanting: number): Progress {
  const { todayIdx } = w;
  const plantIdx = todayIdx - daysSincePlanting;
  const covered = plantIdx >= 0;
  const from = Math.max(0, plantIdx);

  let acc = 0;
  const cumulative: number[] = [];
  for (let i = from; i <= todayIdx; i++) {
    acc += dailyGdd(crop, w.tmax[i] ?? null, w.tmin[i] ?? null);
    cumulative.push(acc);
  }

  let gdd7 = 0;
  let n7 = 0;
  for (let i = Math.max(from, todayIdx - 7); i < todayIdx; i++) {
    gdd7 += dailyGdd(crop, w.tmax[i] ?? null, w.tmin[i] ?? null);
    n7++;
  }
  const avgDailyGdd7 = n7 ? gdd7 / n7 : 0;
  const calendarPace = crop.gddTotal / crop.seasonDays;
  const paceRatio = calendarPace > 0 ? avgDailyGdd7 / calendarPace : 1;

  const calendarProgress = daysSincePlanting / crop.seasonDays;
  const gddProgress = acc / crop.gddTotal;
  const progress = covered ? gddProgress : calendarProgress;

  const remainingGdd = Math.max(0, crop.gddTotal - acc);
  const projectedHarvestDay =
    covered && avgDailyGdd7 > 0.5
      ? Math.round(daysSincePlanting + remainingGdd / avgDailyGdd7)
      : crop.seasonDays;

  const progressAt = (dayOffset: number) => {
    if (!covered) return dayOffset / crop.seasonDays;
    const idx = dayOffset - (daysSincePlanting - (cumulative.length - 1));
    if (dayOffset <= daysSincePlanting) {
      const c = cumulative[Math.max(0, Math.min(cumulative.length - 1, idx))] ?? 0;
      return c / crop.gddTotal;
    }
    // Beyond today, extend at the recent observed pace.
    const extra = (dayOffset - daysSincePlanting) * (avgDailyGdd7 || calendarPace);
    return (acc + extra) / crop.gddTotal;
  };

  return { progress, gddBased: covered, accumulatedGdd: acc, avgDailyGdd7, paceRatio, projectedHarvestDay, progressAt };
}

export type Alert = { kind: "frost" | "heat" | "wet"; text: string };

export function weatherAlerts(crop: Crop, w: DailyWeather, stage: Stage): Alert[] {
  const alerts: Alert[] = [];
  const { todayIdx } = w;

  if (crop.frostSensitiveStages.includes(stage.name)) {
    for (let i = todayIdx; i < Math.min(w.dates.length, todayIdx + 7); i++) {
      const t = w.tmin[i];
      if (t != null && t <= crop.frostThreshold) {
        const d = i - todayIdx;
        alerts.push({
          kind: "frost",
          text: `Frost risk ${d === 0 ? "tonight" : `in ${d} day${d === 1 ? "" : "s"}`} (${t.toFixed(0)}°C) — ${stage.name} is frost-sensitive for this crop.`,
        });
        break;
      }
    }
  }

  if (crop.heatSensitiveStages.includes(stage.name)) {
    for (let i = todayIdx; i < Math.min(w.dates.length, todayIdx + 6); i++) {
      const t = w.tmax[i];
      if (t != null && t >= crop.heatThreshold) {
        const d = i - todayIdx;
        alerts.push({
          kind: "heat",
          text: `Heat stress ${d === 0 ? "today" : `in ${d} day${d === 1 ? "" : "s"}`} (${t.toFixed(0)}°C) during ${stage.name} — expect pollination or set losses.`,
        });
        break;
      }
    }
  }

  let wet = 0;
  for (let i = todayIdx; i < Math.min(w.dates.length, todayIdx + 5); i++) wet += w.precip[i] ?? 0;
  if (wet > 60) {
    alerts.push({
      kind: "wet",
      text: `${Math.round(wet)}mm of rain forecast in the next 5 days — disease pressure and waterlogging risk rise sharply.`,
    });
  }

  return alerts;
}

export type Recommendation = {
  tone: "water" | "ok" | "watch" | "plan";
  title: string;
  text: string;
  subtext?: string | undefined;
};

export function recommendation(
  crop: Crop,
  wb: WaterBalance,
  stage: Stage,
  alerts: Alert[],
): Recommendation {
  const pct = Math.round(wb.depletionPct);
  const critical = stage.critical;

  if (crop.flooded) {
    const shortfall = Math.round(wb.past7Etc - wb.past7Rain);
    if (shortfall > 5) {
      return {
        tone: "water",
        title: "Keep water in the field",
        text: `Rainfall covered only ${Math.round(wb.past7Rain)}mm of the ${Math.round(wb.past7Etc)}mm your crop used this week — about ${shortfall}mm has to come from irrigation.`,
        subtext: critical ? `${stage.name} is a stage where the field should never be allowed to dry.` : undefined,
      };
    }
    return {
      tone: "ok",
      title: "Water supply is keeping up",
      text: `Rain roughly matched crop use this week (${Math.round(wb.past7Rain)}mm in, ${Math.round(wb.past7Etc)}mm used). Maintain your normal standing depth.`,
    };
  }

  if (pct >= crop.depletionTrigger * 100) {
    return {
      tone: "water",
      title: critical ? "Irrigate now — critical stage" : "Time to irrigate",
      text: `The root zone is about ${pct}% depleted. Roughly ${wb.refillNeed}mm would bring it back to full.`,
      subtext: critical
        ? `${stage.name} is one of this crop's yield-defining stages — stress here is not recoverable.`
        : `Next 16 days show about ${Math.round(wb.forecastRain16)}mm of rain forecast.`,
    };
  }

  if (wb.daysToStress != null && wb.daysToStress <= 5) {
    return {
      tone: "watch",
      title: `Plan to irrigate in about ${wb.daysToStress} day${wb.daysToStress === 1 ? "" : "s"}`,
      text: `Soil moisture is at ${100 - pct}% of capacity and forecast rain (${Math.round(wb.forecastRain16)}mm over 16 days) won't cover demand.`,
      subtext: critical ? `Don't let this slip — ${stage.name} is a critical stage.` : undefined,
    };
  }

  if (alerts.length) {
    return {
      tone: "watch",
      title: "Water is fine — but watch the weather",
      text: `Soil moisture is comfortable (${100 - pct}% of capacity). The alerts above are the thing to act on this week.`,
    };
  }

  return {
    tone: "ok",
    title: "You can skip watering",
    text: `The root zone is only about ${pct}% depleted${wb.daysToStress ? ` and won't reach the stress point for roughly ${wb.daysToStress} days` : ""}. No action needed today.`,
  };
}
