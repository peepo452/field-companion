import { createServerFn } from "@tanstack/react-start";
import type { SatelliteReport } from "./satellite";

export const getSatelliteReport = createServerFn({ method: "POST" })
  .inputValidator((input: { lat: number; lon: number; hectares: number }) => input)
  .handler(async ({ data }): Promise<SatelliteReport> => {
    const { buildSatelliteReport } = await import("./satellite.server");
    const hectares = Math.min(Math.max(data.hectares, 0.25), 200);
    return buildSatelliteReport(data.lat, data.lon, hectares);
  });
