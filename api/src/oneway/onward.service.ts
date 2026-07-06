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
import { createQuery, getFlights, Passengers } from 'fast-flights-ts';
import { timeOnDate, type CharterExtras } from './oneway.service.js';

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
  source: 'RYANAIR' | 'WIZZAIR' | 'GOOGLE' | 'RAINBOW';
  airline: string;
  flightNumber: string | null;
  charter?: CharterExtras; // r.pl deep-link data, source === 'RAINBOW' only
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
const GOOGLE_CONCURRENCY = 6;
const GOOGLE_BATCH_DELAY_MS = 150;

// Carriers already covered by their dedicated fetchers — dropped from Google
// results to avoid duplicates (Buzz/Lauda/Malta Air are Ryanair-group).
const GOOGLE_EXCLUDED_AIRLINES = /ryanair|wizz|buzz|lauda|malta air/i;

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

async function runConcurrent<T, R>(
  items: readonly T[],
  fn: (item: T) => Promise<R[]>,
  concurrency: number,
  delayMs: number,
): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const settled = await Promise.allSettled(
      items.slice(i, i + concurrency).map(fn),
    );
    for (const s of settled) {
      // Individual route failures are dropped — a partial list beats a 500.
      if (s.status === 'fulfilled') out.push(...s.value);
    }
    if (i + concurrency < items.length) await sleep(delayMs);
  }
  return out;
}

// Shape of a fast-flights-ts itinerary (fields we rely on).
interface GoogleItinerary {
  type?: string; // airline IATA code, e.g. "VY"
  price?: number; // in the requested currency (PLN)
  airlines?: string[];
  flights: Array<{
    from_airport: { code: string };
    to_airport: { code: string };
    departure: { date: number[]; time: number[] };
    arrival: { date: number[]; time: number[] };
  }>;
}

// [2026,7,7] + [5,55] → "2026-07-07T05:55:00Z" (wall-clock-as-UTC convention).
function googleIso(date: number[], time: number[]): string {
  const [y, m, d] = date;
  const [hh = 0, mm = 0] = time;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${y}-${p(m)}-${p(d)}T${p(hh)}:${p(mm)}:00Z`;
}

@Injectable()
export class OnwardService {
  // In-memory caches storing in-flight promises so concurrent requests for
  // the same key share one carrier fetch. Lost on restart — acceptable.
  private ryanairDayCache = new Map<string, CacheEntry<OnwardFlight[]>>();
  private windowCache = new Map<string, CacheEntry<OnwardFlight[]>>();
  private googleDayCache = new Map<string, CacheEntry<OnwardFlight[]>>();
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
    const carrier =
      params.carrier === 'wizz' || params.carrier === 'google'
        ? params.carrier
        : 'ryanair';
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
    if (carrier === 'google') {
      flights = await this.getGoogleDay(mode, airport, date);
    } else if (carrier === 'ryanair' && mode === 'departures') {
      flights = await this.getRyanairDeparturesDay(airport, date);
    } else {
      flights = await this.getWindow(carrier, mode, airport, windowStart);
    }

    // One-way charters exist in both directions (Poland→dest and dest→Poland),
    // so they can feed either mode. Piggyback on the base (ryanair) stream —
    // DB lookup, no extra cost.
    if (carrier === 'ryanair') {
      flights = [...flights, ...(await this.getCharters(mode, airport, date))];
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

      await this.enrichCities(flights, iatas);
      return flights;
    });
  }

  // ── Google Flights (fast-flights-ts): other carriers, non-stop only ─────
  // Google has no "anywhere" search either, so we fan out over the union of
  // known Ryanair+Wizz routes; the same city pairs surface easyJet, Vueling
  // and other carriers. Day-granular (a whole window would be 8× the calls).

  private getGoogleDay(
    mode: OnwardMode,
    airport: string,
    date: string,
  ): Promise<OnwardFlight[]> {
    const key = `${mode}:${airport}:${date}`;
    return this.cached(this.googleDayCache, key, WINDOW_TTL_MS, async () => {
      const [ryanRoutes, wizzRoutes] = await Promise.all([
        this.cached(this.routesCache, `ryanair:${airport}`, ROUTES_TTL_MS, () =>
          getDestinations(airport),
        ).catch(() => [] as string[]),
        this.cached(this.routesCache, `wizz:${airport}`, ROUTES_TTL_MS, () =>
          getWizzRoutes(airport),
        ).catch(() => [] as string[]),
      ]);
      const routes = [...new Set([...ryanRoutes, ...wizzRoutes])];
      if (routes.length === 0) return [];

      const itineraries = await runConcurrent(
        routes,
        async (r) => {
          const [from_airport, to_airport] =
            mode === 'departures' ? [airport, r] : [r, airport];
          const query = createQuery({
            flights: [{ date, from_airport, to_airport }],
            trip: 'one-way',
            seat: 'economy',
            passengers: new Passengers({ adults: 1 }),
            currency: 'PLN',
            max_stops: 0,
          });
          return (await getFlights(query)) as unknown as GoogleItinerary[];
        },
        GOOGLE_CONCURRENCY,
        GOOGLE_BATCH_DELAY_MS,
      );

      const flights: OnwardFlight[] = [];
      const iatas = new Set<string>();
      const seen = new Set<string>();
      for (const it of itineraries) {
        // max_stops:0 requested, but stay defensive about multi-leg rows.
        if (it.flights?.length !== 1 || !it.price || it.price <= 0) continue;
        const airline = it.airlines?.join(' + ') || it.type || '';
        if (!airline || GOOGLE_EXCLUDED_AIRLINES.test(airline)) continue;
        const leg = it.flights[0];
        const departureTime = googleIso(leg.departure.date, leg.departure.time);
        const dedupeKey = `${airline}:${leg.from_airport.code}:${leg.to_airport.code}:${departureTime}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);
        iatas.add(leg.from_airport.code);
        iatas.add(leg.to_airport.code);
        flights.push({
          origin: leg.from_airport.code,
          destination: leg.to_airport.code,
          originCity: leg.from_airport.code, // enriched from DB below
          originCountry: '',
          destCity: leg.to_airport.code,
          destCountry: '',
          date: departureTime.slice(0, 10),
          departureTime,
          arrivalTime: googleIso(leg.arrival.date, leg.arrival.time),
          price: Math.round(it.price * 100) / 100,
          currency: 'PLN',
          source: 'GOOGLE',
          airline,
          flightNumber: null,
        });
      }

      await this.enrichCities(flights, iatas);
      return flights;
    });
  }

  // One-way Rainbow charters touching `airport` on `date`, straight from the
  // DB snapshot (no caching needed). arrivals → charters landing there;
  // departures → charters taking off there (dest→Poland legs).
  private async getCharters(
    mode: OnwardMode,
    airport: string,
    date: string,
  ): Promise<OnwardFlight[]> {
    const rows = await prisma.charterFlight.findMany({
      where: {
        oneWay: true,
        ...(mode === 'arrivals' ? { destIata: airport } : { depIata: airport }),
        date: new Date(`${date}T00:00:00Z`),
      },
    });
    return rows.map((c) => {
      const departureTime = timeOnDate(c.date, c.depTime);
      const arrivalTime = timeOnDate(
        c.date,
        c.arrTime,
        c.arrTime < c.depTime ? 1 : 0,
      );
      return {
        origin: c.depIata,
        destination: c.destIata,
        originCity: c.depAirport,
        // Whichever end is not Poland has no country in charter data.
        originCountry: c.destCountry === 'Polska' ? '' : 'Polska',
        destCity: c.destName,
        destCountry: c.destCountry,
        date,
        departureTime: departureTime.toISOString(),
        arrivalTime: arrivalTime.toISOString(),
        price: c.price,
        currency: 'PLN' as const,
        source: 'RAINBOW' as const,
        airline: c.airline,
        flightNumber: c.flightNo,
        charter: {
          destCountryUrl: c.destCountryUrl,
          destNameUrl: c.destNameUrl,
          pakietId: c.pakietId,
          baggageKg: c.baggageKg,
        },
      };
    });
  }

  // Resolve IATA codes to city names from the airports table synced by
  // AirportsService (fallback: the code itself, set by the caller).
  private async enrichCities(
    flights: OnwardFlight[],
    iatas: Set<string>,
  ): Promise<void> {
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
  }
}
