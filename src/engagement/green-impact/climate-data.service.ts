import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

// Greater Manchester city centre coordinates — used for the Open-Meteo calls.
const GM_LAT = 53.4808;
const GM_LON = -2.2426;

// Manchester (M) outward postcode — used to scope the Carbon Intensity API's
// regional endpoints to the North West England / Greater Manchester DNO
// region rather than the GB national figure.
const GM_POSTCODE = 'M1';

export interface ClimateSnapshot {
  avgTemperatureRiseC: number | null;
  renewableEnergyPct: number | null;
  emissionsByMonth: { month: string; gCO2PerKWh: number | null }[];
  source: 'live' | 'unavailable';
}

/**
 * Both providers below are free, keyless, public APIs:
 *  - Open-Meteo (open-meteo.com) — climate archive, no API key, CC BY 4.0.
 *  - UK Carbon Intensity API (carbonintensity.org.uk) — National Energy
 *    System Operator, no API key, CC BY 4.0.
 * Calls are best-effort: if either provider is down we return nulls for
 * that slice rather than failing the whole dashboard, and the frontend
 * shows "data unavailable" instead of a fabricated number.
 */
@Injectable()
export class ClimateDataService {
  private readonly logger = new Logger(ClimateDataService.name);

  constructor(private readonly http: HttpService) {}

  /** Recent 5-year average temperature vs the 1991-2020 baseline for the
   *  same calendar window, both pulled from Open-Meteo's historical
   *  archive — this is what "Avg. Temperature Rise" is measuring. */
  async temperatureRiseC(): Promise<number | null> {
    try {
      const today = new Date();
      const recentEnd = this.isoDate(today);
      const recentStart = this.isoDate(this.addYears(today, -5));
      const baselineStart = '1991-01-01';
      const baselineEnd = '2020-12-31';

      const [recent, baseline] = await Promise.all([
        this.fetchArchiveAvgTemp(recentStart, recentEnd),
        this.fetchArchiveAvgTemp(baselineStart, baselineEnd),
      ]);

      if (recent === null || baseline === null) return null;
      return Math.round((recent - baseline) * 10) / 10;
    } catch (err) {
      this.logger.warn(`temperatureRiseC failed: ${(err as Error).message}`);
      return null;
    }
  }

  private async fetchArchiveAvgTemp(start: string, end: string): Promise<number | null> {
    const url = 'https://archive-api.open-meteo.com/v1/archive';
    const { data } = await firstValueFrom(
      this.http.get(url, {
        params: {
          latitude: GM_LAT,
          longitude: GM_LON,
          start_date: start,
          end_date: end,
          daily: 'temperature_2m_mean',
          timezone: 'Europe/London',
        },
        timeout: 8000,
      }),
    );
    const values: number[] = data?.daily?.temperature_2m_mean ?? [];
    const clean = values.filter((v) => typeof v === 'number');
    if (!clean.length) return null;
    return clean.reduce((a, b) => a + b, 0) / clean.length;
  }

  /** Current renewable share (wind + solar + hydro) of the electricity
   *  generation mix for the Manchester region, from the Carbon Intensity
   *  API's regional generation-mix data. */
  async renewableEnergyPct(): Promise<number | null> {
    try {
      const url = `https://api.carbonintensity.org.uk/regional/postcode/${GM_POSTCODE}`;
      const { data } = await firstValueFrom(this.http.get(url, { timeout: 8000 }));
      const mix = data?.data?.[0]?.data?.[0]?.generationmix as
        | { fuel: string; perc: number }[]
        | undefined;
      if (!mix) return null;

      const renewableFuels = new Set(['wind', 'solar', 'hydro', 'biomass']);
      const renewablePct = mix
        .filter((m) => renewableFuels.has(m.fuel))
        .reduce((sum, m) => sum + m.perc, 0);

      return Math.round(renewablePct * 10) / 10;
    } catch (err) {
      this.logger.warn(`renewableEnergyPct failed: ${(err as Error).message}`);
      return null;
    }
  }

  /** Regional grid carbon intensity (gCO2/kWh) sampled at the first day of
   *  each of the last N months — used as the "Emissions" line on the
   *  CO2 Emissions vs Offset chart, alongside our own users' real logged
   *  offset totals for the same months. */
  async emissionsByMonth(months = 6): Promise<{ month: string; gCO2PerKWh: number | null }[]> {
    const results: { month: string; gCO2PerKWh: number | null }[] = [];
    const now = new Date();

    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1, 12, 0, 0);
      const label = d.toLocaleString('en-GB', { month: 'short' });
      const from = new Date(d);
      from.setUTCHours(0, 0, 0, 0);
      const to = new Date(from);
      to.setUTCHours(23, 30, 0, 0);

      try {
        const url = `https://api.carbonintensity.org.uk/regional/intensity/${from.toISOString()}/${to.toISOString()}/postcode/${GM_POSTCODE}`;
        const { data } = await firstValueFrom(this.http.get(url, { timeout: 8000 }));
        const points = data?.data?.[0]?.data as
          | { intensity: { forecast: number; actual: number | null } }[]
          | undefined;

        if (!points?.length) {
          results.push({ month: label, gCO2PerKWh: null });
          continue;
        }
        const values = points.map((p) => p.intensity.actual ?? p.intensity.forecast);
        const avg = values.reduce((a, b) => a + b, 0) / values.length;
        results.push({ month: label, gCO2PerKWh: Math.round(avg) });
      } catch (err) {
        this.logger.warn(`emissionsByMonth(${label}) failed: ${(err as Error).message}`);
        results.push({ month: label, gCO2PerKWh: null });
      }
    }

    return results;
  }

  private isoDate(d: Date): string {
    return d.toISOString().slice(0, 10);
  }

  private addYears(d: Date, years: number): Date {
    const copy = new Date(d);
    copy.setFullYear(copy.getFullYear() + years);
    return copy;
  }
}
