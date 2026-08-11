import type { DailyWeather } from "./agronomy";

export type Place = { name: string; latitude: number; longitude: number };

export async function geocode(query: string): Promise<Place> {
  const res = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en&format=json`,
  );
  if (!res.ok) throw new Error("Location lookup failed. Check your connection and try again.");
  const data = (await res.json()) as {
    results?: { name: string; admin1?: string; country?: string; latitude: number; longitude: number }[];
  };
  const r = data.results?.[0];
  if (!r) throw new Error("Couldn't find that location. Try a nearby town or city name.");
  return {
    name: [r.name, r.admin1, r.country].filter(Boolean).join(", "),
    latitude: r.latitude,
    longitude: r.longitude,
  };
}

/** Local (not UTC) YYYY-MM-DD — using toISOString here shifts the day for most of the world. */
export function localISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function fetchWeather(
  place: Place,
  daysSincePlanting: number,
): Promise<DailyWeather> {
  // Open-Meteo's forecast endpoint serves at most 92 past days.
  const pastDays = Math.min(92, Math.max(14, daysSincePlanting + 1));
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}` +
    `&daily=precipitation_sum,et0_fao_evapotranspiration,temperature_2m_max,temperature_2m_min,shortwave_radiation_sum` +
    `&past_days=${pastDays}&forecast_days=16&timezone=auto`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Weather service didn't respond. Please try again in a moment.");
  const data = (await res.json()) as { daily?: Record<string, (number | null)[]> & { time: string[] } };
  const daily = data.daily;
  if (!daily?.time?.length) throw new Error("No weather data available for that location.");

  const dates = daily.time;
  const todayStr = localISODate(new Date());
  let todayIdx = dates.indexOf(todayStr);
  if (todayIdx === -1) todayIdx = Math.min(pastDays, dates.length - 1);

  const num = (arr: (number | null)[] | undefined) => (arr ?? []).map((v) => (v == null ? 0 : v));

  return {
    dates,
    precip: num(daily["precipitation_sum"]),
    et0: num(daily["et0_fao_evapotranspiration"]),
    tmax: num(daily["temperature_2m_max"]),
    tmin: num(daily["temperature_2m_min"]),
    solar: num(daily["shortwave_radiation_sum"]),
    todayIdx,
    pastDays: todayIdx,
  };
}
