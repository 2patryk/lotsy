import { fetchJsonPost, fetchJson, fetchText } from './http.ts';
import type {
  DailyFare,
  WizzTimetableParams,
  WizzTimetableResponse,
  WizzTimetableFlight,
  WizzMapResponse,
} from './types.ts';

// Wizz Air's own (unofficial) backend. The version segment in the path changes
// on every deploy; we detect it dynamically and fall back to this seed.
const BE = 'https://be.wizzair.com';
const SEED_VERSION = '10.1.0';

// Wizz's timetable endpoint accepts at most a 42-day window per request.
const MAX_WINDOW_DAYS = 42;

// Headers required by CloudFront — without a matching Origin/Referer the
// backend returns 403 to non-browser clients.
const WIZZ_HEADERS: Record<string, string> = {
  Origin: 'https://wizzair.com',
  Referer: 'https://wizzair.com/pl-pl/flights/timetable',
};

let cachedVersion: string | null = null;

/**
 * Returns the current Wizz Air API version, scraped once from the public site
 * and cached in memory. Falls back to SEED_VERSION when scraping fails.
 */
export async function getWizzApiVersion(force = false): Promise<string> {
  if (cachedVersion && !force) return cachedVersion;

  try {
    const html = await fetchText('https://wizzair.com/', WIZZ_HEADERS);
    const match = html.match(/be\.wizzair\.com\/(\d+\.\d+\.\d+)/);
    cachedVersion = match ? match[1] : SEED_VERSION;
  } catch {
    cachedVersion = SEED_VERSION;
  }

  return cachedVersion;
}

// Runs a request against the versioned backend; if the version looks stale
// (4xx), refreshes the version once and retries.
async function withVersion<T>(path: string, run: (base: string) => Promise<T>): Promise<T> {
  const version = await getWizzApiVersion();
  try {
    return await run(`${BE}/${version}/${path}`);
  } catch (err) {
    const fresh = await getWizzApiVersion(true);
    if (fresh === version) throw err;
    return run(`${BE}/${fresh}/${path}`);
  }
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Splits [from, to] into <=42-day windows (Wizz's per-request cap).
function windows(from: string, to: string): Array<{ from: string; to: string }> {
  const out: Array<{ from: string; to: string }> = [];
  const end = new Date(`${to}T00:00:00Z`);
  let cursor = new Date(`${from}T00:00:00Z`);

  while (cursor <= end) {
    const windowEnd = new Date(cursor.getTime() + (MAX_WINDOW_DAYS - 1) * 86_400_000);
    const clamped = windowEnd > end ? end : windowEnd;
    out.push({ from: isoDay(cursor), to: isoDay(clamped) });
    cursor = new Date(clamped.getTime() + 86_400_000);
  }

  return out;
}

// Wizz returns local wall-clock without a timezone; append 'Z' so the hour
// survives a downstream new Date(...).toISOString() round-trip (matches Ryanair).
function asUtcWallClock(t: string): string {
  return /[Z+]/.test(t.slice(11)) ? t : t + 'Z';
}

function toDailyFare(f: WizzTimetableFlight): DailyFare {
  const departureTime = asUtcWallClock(f.departureDates?.[0] ?? f.departureDate);
  const arrivalTime = asUtcWallClock(
    f.arrivalDates?.[0] ?? f.departureDates?.[0] ?? f.departureDate,
  );
  return {
    date: f.departureDate.slice(0, 10),
    departureTime,
    arrivalTime,
    price: f.price.amount,
    currency: f.price.currencyCode,
    airline: 'Wizz Air',
    source: 'WIZZAIR',
    origin: f.departureStation,
    destination: f.arrivalStation,
  };
}

/**
 * Returns the cheapest one-way fare per day for a route, over the given date
 * range. Only the outbound direction (origin→destination) is returned; call
 * again with swapped stations for the return leg. Splits the range into 42-day
 * windows automatically.
 */
export async function getWizzTimetable(params: WizzTimetableParams): Promise<DailyFare[]> {
  const { origin, destination, from, to, priceType = 'regular' } = params;
  const fares: DailyFare[] = [];

  for (const w of windows(from, to)) {
    const body = {
      flightList: [
        { departureStation: origin, arrivalStation: destination, from: w.from, to: w.to },
        { departureStation: destination, arrivalStation: origin, from: w.from, to: w.to },
      ],
      priceType,
      adultCount: 1,
      childCount: 0,
      infantCount: 0,
    };

    const data = await withVersion('Api/search/timetable', (base) =>
      fetchJsonPost<WizzTimetableResponse>(base, body, WIZZ_HEADERS),
    );

    for (const f of data.outboundFlights ?? []) {
      if (f.price?.amount > 0) fares.push(toDailyFare(f));
    }
  }

  return fares;
}

/**
 * Returns IATA codes of destinations served from the given origin airport,
 * from Wizz's full route map. Should be cached — call once per day.
 */
export async function getWizzRoutes(origin: string): Promise<string[]> {
  const data = await withVersion('Api/asset/map?languageCode=pl-pl', (base) =>
    fetchJson<WizzMapResponse>(base, WIZZ_HEADERS),
  );

  const city = (data.cities ?? []).find((c) => c.iata === origin);
  return (city?.connections ?? []).map((c) => c.iata).filter(Boolean);
}
