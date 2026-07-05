import { BadRequestException, Injectable } from '@nestjs/common';
import { prisma } from '@lotsy/db';
import {
  getCheapestPerDay,
  getDestinations,
  getOneWayFaresList,
  getPlnRates,
  getWizzRoutes,
  getWizzTimetable,
  toPln,
} from '@lotsy/flights-client';
import type { DailyFare } from '@lotsy/flights-client';

// One row in the onward-connections panel, price already normalized to PLN.
// mode=departures: flights leaving `airport` (after an OUT fare's arrival).
// mode=arrivals: flights into `airport` (feeding an IN fare's departure).
export interface OnwardFlight {
  origin: string;
  destination: string;
  originCity: string;
  originCountry: string;
  destCity: string;
  destCountry: string;
  date: string; // YYYY-MM-DD
  departureTime: string; // ISO datetime (wall-clock with Z, matches OneWayFare)
  arrivalTime: string;
  price: number; // PLN
  currency: 'PLN';
  source: 'RYANAIR' | 'WIZZAIR';
  airline: string;
  flightNumber: string | null;
}

export type OnwardMode = 'departures' | 'arrivals';

// Day window the frontend can page through (8 pills: base day ±0…7).
const WINDOW_DAYS = 8;
// How far ahead a lookup may start — keeps arbitrary dates out of carrier APIs.
const MAX_LOOKAHEAD_DAYS = 62;

const RYANAIR_DAY_TTL_MS = 15 * 60_000;
const WINDOW_TTL_MS = 30 * 60_000;
const ROUTES_TTL_MS = 24 * 60 * 60_000;

// Per-route fan-outs (Wizz always; Ryanair in arrivals mode) — keep them
// gentle to avoid carrier throttling, mirroring the engine's settings.
const RYAN_CONCURRENCY = 3;
const RYAN_BATCH_DELAY_MS = 300;
const WIZZ_CONCURRENCY = 2;
const WIZZ_BATCH_DELAY_MS = 350;

const IATA_RE = /^[A-Z]{3}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

interface CacheEntry<T> {
  expires: number;
  promise: Promise<T>;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function addDays(day: string, days: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

// Distinct (year, month) pairs covered by an inclusive day range.
function monthsInRange(
  from: string,
  to: string,
): Array<{ year: number; month: number }> {
  const out: Array<{ year: number; month: number }> = [];
  let cursor = new Date(`${from.slice(0, 7)}-01T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  while (cursor <= end) {
    out.push({ year: cursor.getUTCFullYear(), month: cursor.getUTCMonth() });
    cursor = new Date(
      Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1),
    );
  }
  return out;
}

// Carriers return local wall-clock without a timezone; append 'Z' so the hour
// survives Date parsing on the frontend (same convention as the engine).
function asUtcWallClock(t: string): string {
  return /[Z+]/.test(t.slice(11)) ? t : t + 'Z';
}

async function runConcurrent<T>(
  items: readonly T[],
  fn: (item: T) => Promise<DailyFare[]>,
  concurrency: number,
  delayMs: number,
): Promise<DailyFare[]> {
  const fares: DailyFare[] = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const settled = await Promise.allSettled(
      items.slice(i, i + concurrency).map(fn),
    );
    for (const s of settled) {
      // Individual route failures are dropped — a partial list beats a 500.
      if (s.status === 'fulfilled') fares.push(...s.value);
    }
    if (i + concurrency < items.length) await sleep(delayMs);
  }
  return fares;
}

@Injectable()
export class OnwardService {
  // In-memory caches storing in-flight promises so concurrent requests for
  // the same key share one carrier fetch. Lost on restart — acceptable.
  private ryanairDayCache = new Map<string, CacheEntry<OnwardFlight[]>>();
  private windowCache = new Map<string, CacheEntry<OnwardFlight[]>>();
  private routesCache = new Map<string, CacheEntry<string[]>>();

  async getOnward(params: {
    airport?: string;
    date?: string;
    carrier?: string;
    mode?: string;
    windowStart?: string;
  }): Promise<OnwardFlight[]> {
    const airport = params.airport?.toUpperCase() ?? '';
    const date = params.date ?? '';
    const carrier = params.carrier === 'wizz' ? 'wizz' : 'ryanair';
    const mode: OnwardMode =
      params.mode === 'arrivals' ? 'arrivals' : 'departures';
    const windowStart = params.windowStart || date;

    if (!IATA_RE.test(airport)) {
      throw new BadRequestException('airport must be a 3-letter IATA code');
    }
    if (!DATE_RE.test(date) || !DATE_RE.test(windowStart)) {
      throw new BadRequestException('date/windowStart must be YYYY-MM-DD');
    }
    const today = todayIso();
    if (date < today || windowStart > addDays(today, MAX_LOOKAHEAD_DAYS)) {
      throw new BadRequestException('date out of allowed range');
    }
    if (date < windowStart || date > addDays(windowStart, WINDOW_DAYS - 1)) {
      throw new BadRequestException('date must be within the window');
    }

    let flights: OnwardFlight[];
    if (carrier === 'ryanair' && mode === 'departures') {
      flights = await this.getRyanairDeparturesDay(airport, date);
    } else {
      flights = await this.getWindow(carrier, mode, airport, windowStart);
    }

    return flights
      .filter((f) => f.date === date)
      .sort((a, b) => a.price - b.price);
  }

  private cached<T>(
    cache: Map<string, CacheEntry<T>>,
    key: string,
    ttlMs: number,
    fetcher: () => Promise<T>,
  ): Promise<T> {
    const hit = cache.get(key);
    if (hit && hit.expires > Date.now()) return hit.promise;

    const promise = fetcher();
    cache.set(key, { expires: Date.now() + ttlMs, promise });
    // Drop failed fetches so the next request retries instead of caching an error.
    promise.catch(() => cache.delete(key));
    return promise;
  }

  // ── Ryanair departures: one cheap list call per (airport, day) ──────────

  private getRyanairDeparturesDay(
    airport: string,
    date: string,
  ): Promise<OnwardFlight[]> {
    return this.cached(
      this.ryanairDayCache,
      `${airport}:${date}`,
      RYANAIR_DAY_TTL_MS,
      async () => {
        const [items, rates] = await Promise.all([
          getOneWayFaresList({
            departureAirportIataCode: airport,
            outboundDepartureDateFrom: date,
            outboundDepartureDateTo: date,
            currency: 'PLN',
            market: 'pl-pl',
          }),
          getPlnRates(),
        ]);

        const flights: OnwardFlight[] = [];
        for (const i of items) {
          // Ryanair usually honors currency=PLN, but foreign departures can
          // still come back in local currency — normalize defensively.
          const pln = toPln(i.price, i.currency, rates);
          if (pln == null) continue;
          flights.push({
            origin: i.origin,
            destination: i.destination,
            originCity: i.originCity,
            originCountry: i.originCountry,
            destCity: i.destCity,
            destCountry: i.destCountry,
            date: i.date,
            departureTime: asUtcWallClock(i.departureTime),
            arrivalTime: asUtcWallClock(i.arrivalTime),
            price: pln,
            currency: 'PLN',
            source: 'RYANAIR',
            airline: 'Ryanair',
            flightNumber: i.flightNumber ?? null,
          });
        }
        return flights;
      },
    );
  }

  // ── Per-route fan-out over the whole 8-day window ───────────────────────
  // Used by Wizz (no "all departures" endpoint) and by Ryanair arrivals mode
  // (its list endpoint rejects arrival-only filters).

  private getWindow(
    carrier: 'ryanair' | 'wizz',
    mode: OnwardMode,
    airport: string,
    windowStart: string,
  ): Promise<OnwardFlight[]> {
    const key = `${carrier}:${mode}:${airport}:${windowStart}`;
    return this.cached(this.windowCache, key, WINDOW_TTL_MS, async () => {
      const routes = await this.cached(
        this.routesCache,
        `${carrier}:${airport}`,
        ROUTES_TTL_MS,
        () =>
          carrier === 'wizz'
            ? getWizzRoutes(airport)
            : getDestinations(airport),
      );
      if (routes.length === 0) return [];

      // The window may reach into the past (arrivals mode counts backwards
      // from the clicked flight) — never query carriers for past days.
      const from = windowStart < todayIso() ? todayIso() : windowStart;
      const to = addDays(windowStart, WINDOW_DAYS - 1);
      if (from > to) return [];
      const rates = await getPlnRates();

      const fares =
        carrier === 'wizz'
          ? await runConcurrent(
              routes,
              (r) =>
                getWizzTimetable(
                  mode === 'departures'
                    ? { origin: airport, destination: r, from, to }
                    : { origin: r, destination: airport, from, to },
                ),
              WIZZ_CONCURRENCY,
              WIZZ_BATCH_DELAY_MS,
            )
          : await runConcurrent(
              routes,
              async (r) => {
                // arrivals mode only: departures use the single list call above.
                const perMonth = await Promise.all(
                  monthsInRange(from, to).map((m) =>
                    getCheapestPerDay(r, airport, m.year, m.month, 'PLN'),
                  ),
                );
                return perMonth.flat();
              },
              RYAN_CONCURRENCY,
              RYAN_BATCH_DELAY_MS,
            );

      const flights: OnwardFlight[] = [];
      const iatas = new Set<string>();
      const seen = new Set<string>();
      for (const f of fares) {
        if (f.date < from || f.date > to) continue;
        // Wizz timetable occasionally returns the same rotation twice.
        const dedupeKey = `${f.origin}:${f.destination}:${f.departureTime}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);
        // Wizz timetable can answer with a nearby station (e.g. MXP for BGY);
        // keep only flights actually touching the requested airport.
        if (
          mode === 'departures'
            ? f.origin !== airport
            : f.destination !== airport
        )
          continue;
        const pln = toPln(f.price, f.currency, rates);
        if (pln == null) continue;
        iatas.add(f.origin);
        iatas.add(f.destination);
        flights.push({
          origin: f.origin,
          destination: f.destination,
          originCity: f.origin, // enriched from DB below
          originCountry: '',
          destCity: f.destination,
          destCountry: '',
          date: f.date,
          departureTime: f.departureTime,
          arrivalTime: f.arrivalTime,
          price: pln,
          currency: 'PLN',
          source: carrier === 'wizz' ? 'WIZZAIR' : 'RYANAIR',
          airline: carrier === 'wizz' ? 'Wizz Air' : 'Ryanair',
          flightNumber: null,
        });
      }

      // Timetable rows carry only IATA codes — resolve city names from the
      // airports table synced by AirportsService (fallback: the code itself).
      const airports = await prisma.airport.findMany({
        where: { iata: { in: [...iatas] } },
      });
      const byIata = new Map(airports.map((a) => [a.iata, a]));
      for (const f of flights) {
        const o = byIata.get(f.origin);
        const d = byIata.get(f.destination);
        if (o) {
          f.originCity = o.name;
          f.originCountry = o.country.toUpperCase();
        }
        if (d) {
          f.destCity = d.name;
          f.destCountry = d.country.toUpperCase();
        }
      }

      return flights;
    });
  }
}
