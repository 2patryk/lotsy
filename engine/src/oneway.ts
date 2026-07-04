import { prisma, type Prisma } from '@lotsy/db';
import { getCheapestPerDay, getOneWayFaresList } from '@lotsy/flights-client';
import { ORIGIN_AIRPORTS, MAX_CONCURRENT, BATCH_DELAY_MS, ONEWAY_HORIZON_DAYS } from './config.js';

// Standalone engine for the "one-way, last-minute" tab: cheapest Ryanair
// one-way fare per route and day, both directions, within a rolling window
// (today → today + ONEWAY_HORIZON_DAYS).
//
// Two-phase strategy:
//  1. Discovery — one listing call per Polish airport (PL→) and one per
//     foreign country seen so far (→PL) gives the set of routes that are
//     actually active in the window, plus Polish-locale city/country names,
//     essentially for free.
//  2. Detail — cheapestPerDay per active route (both directions) fills in
//     one row per day.

const DRY_RUN = process.argv.includes('--dry-run');
const INSERT_CHUNK = 1000;

type OneWayFareRow = Prisma.OneWayFareCreateManyInput;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function toDateKey(d: Date): string {
  // Build the key from local date parts — toISOString() would shift the day
  // back for timezones ahead of UTC (local midnight = previous day in UTC).
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function windowBounds(): { from: Date; to: Date; fromKey: string; toKey: string } {
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setDate(to.getDate() + ONEWAY_HORIZON_DAYS);
  return { from, to, fromKey: toDateKey(from), toKey: toDateKey(to) };
}

// Every calendar month touched by the window (1 or 2 entries).
function monthsInWindow(from: Date, to: Date): Array<{ year: number; month: number }> {
  const months = new Map<string, { year: number; month: number }>();
  const cursor = new Date(from);
  while (cursor <= to) {
    const key = `${cursor.getFullYear()}-${cursor.getMonth()}`;
    if (!months.has(key)) months.set(key, { year: cursor.getFullYear(), month: cursor.getMonth() });
    cursor.setMonth(cursor.getMonth() + 1, 1); // jump to the 1st of the next month
  }
  return [...months.values()];
}

interface Route {
  origin: string;
  destination: string;
  direction: 'OUT' | 'IN';
}

interface AirportInfo {
  city: string;
  country: string; // Polish name
}

interface DiscoveryResult {
  routes: Route[];
  airportInfo: Map<string, AirportInfo>;
}

async function runConcurrent<T, R>(
  items: readonly T[],
  fn: (item: T) => Promise<R>,
): Promise<Array<{ item: T; result?: R; error?: unknown }>> {
  const results: Array<{ item: T; result?: R; error?: unknown }> = [];
  for (let i = 0; i < items.length; i += MAX_CONCURRENT) {
    const batch = items.slice(i, i + MAX_CONCURRENT);
    const settled = await Promise.allSettled(batch.map(fn));
    for (let j = 0; j < batch.length; j++) {
      const s = settled[j];
      results.push(
        s.status === 'fulfilled'
          ? { item: batch[j], result: s.value }
          : { item: batch[j], error: s.reason },
      );
    }
    if (i + MAX_CONCURRENT < items.length) await sleep(BATCH_DELAY_MS);
  }
  return results;
}

// Phase 1: discover active routes + Polish-locale airport names.
async function discover(fromKey: string, toKey: string): Promise<DiscoveryResult> {
  const routes: Route[] = [];
  const airportInfo = new Map<string, AirportInfo>();
  const foreignCountryCodes = new Set<string>();

  const recordAirportInfo = (iata: string, city: string, country: string) => {
    if (!airportInfo.has(iata)) airportInfo.set(iata, { city, country });
  };

  // 1a. Outbound: one call per Polish airport.
  const outResults = await runConcurrent(ORIGIN_AIRPORTS as readonly string[], (origin) =>
    getOneWayFaresList({
      departureAirportIataCode: origin,
      outboundDepartureDateFrom: fromKey,
      outboundDepartureDateTo: toKey,
    }),
  );

  let outFailures = 0;
  for (const { item: origin, result, error } of outResults) {
    if (error) {
      outFailures++;
      console.warn(`[oneway] discovery OUT failed for ${origin}:`, error);
      continue;
    }
    for (const f of result ?? []) {
      recordAirportInfo(f.origin, f.originCity, f.originCountry);
      recordAirportInfo(f.destination, f.destCity, f.destCountry);
      routes.push({ origin: f.origin, destination: f.destination, direction: 'OUT' });
      if (f.destCountryCode && f.destCountryCode.toLowerCase() !== 'pl') {
        foreignCountryCodes.add(f.destCountryCode.toLowerCase());
      }
    }
  }
  console.log(
    `[oneway] discovery OUT: ${ORIGIN_AIRPORTS.length} airports, ${routes.length} routes, ` +
      `${foreignCountryCodes.size} foreign countries, ${outFailures} failures`,
  );

  // 1b. Inbound: one call per foreign country seen above.
  const inResults = await runConcurrent([...foreignCountryCodes], (cc) =>
    getOneWayFaresList({
      arrivalCountryCode: 'pl',
      departureCountryCode: cc,
      outboundDepartureDateFrom: fromKey,
      outboundDepartureDateTo: toKey,
    }),
  );

  let inFailures = 0;
  let inRoutesCount = 0;
  for (const { item: cc, result, error } of inResults) {
    if (error) {
      inFailures++;
      console.warn(`[oneway] discovery IN failed for ${cc}:`, error);
      continue;
    }
    for (const f of result ?? []) {
      recordAirportInfo(f.origin, f.originCity, f.originCountry);
      recordAirportInfo(f.destination, f.destCity, f.destCountry);
      routes.push({ origin: f.origin, destination: f.destination, direction: 'IN' });
      inRoutesCount++;
    }
  }
  console.log(
    `[oneway] discovery IN: ${foreignCountryCodes.size} countries, ${inRoutesCount} routes, ${inFailures} failures`,
  );

  // Dedup (defensive — shouldn't normally overlap since OUT/IN partition by
  // which side of the pair is Polish).
  const seen = new Set<string>();
  const uniqueRoutes = routes.filter((r) => {
    const key = `${r.origin}:${r.destination}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return { routes: uniqueRoutes, airportInfo };
}

// Phase 2: per-day cheapest fare for every active route, filtered to the window.
async function fetchDetails(
  routes: Route[],
  from: Date,
  to: Date,
  fromKey: string,
  toKey: string,
): Promise<{ rows: OneWayFareRow[]; failures: number }> {
  const months = monthsInWindow(from, to);

  type Task = { route: Route; year: number; month: number };
  const tasks: Task[] = [];
  for (const route of routes) {
    for (const { year, month } of months) {
      tasks.push({ route, year, month });
    }
  }

  const results = await runConcurrent(tasks, (t) =>
    getCheapestPerDay(t.route.origin, t.route.destination, t.year, t.month),
  );

  const rows: OneWayFareRow[] = [];
  let failures = 0;

  for (const { item, result, error } of results) {
    if (error) {
      failures++;
      console.warn(
        `[oneway] cheapestPerDay failed for ${item.route.origin}→${item.route.destination} ` +
          `${item.year}-${item.month + 1}:`,
        error,
      );
      continue;
    }
    for (const f of result ?? []) {
      if (f.date < fromKey || f.date > toKey) continue;
      rows.push({
        direction: item.route.direction,
        origin: item.route.origin,
        originCity: '', // filled in by caller once airport names are known
        originCountry: '',
        destination: item.route.destination,
        destCity: '',
        destCountry: '',
        date: new Date(`${f.date}T00:00:00Z`),
        departureTime: new Date(f.departureTime),
        arrivalTime: new Date(f.arrivalTime),
        flightNumber: null,
        price: f.price,
        currency: f.currency,
      });
    }
  }

  return { rows, failures };
}

function fillAirportNames(
  rows: OneWayFareRow[],
  airportInfo: Map<string, AirportInfo>,
  polishFallback: Map<string, AirportInfo>,
): void {
  const lookup = (iata: string): AirportInfo =>
    airportInfo.get(iata) ?? polishFallback.get(iata) ?? { city: iata, country: '' };

  for (const row of rows) {
    const origin = lookup(row.origin);
    const dest = lookup(row.destination);
    row.originCity = origin.city;
    row.originCountry = origin.country;
    row.destCity = dest.city;
    row.destCountry = dest.country;
  }
}

// Fallback names for the Polish side, in case a route's airport never showed
// up in a discovery response (shouldn't normally happen).
async function buildPolishFallback(): Promise<Map<string, AirportInfo>> {
  const fallback = new Map<string, AirportInfo>();
  try {
    const airports = await prisma.airport.findMany({
      where: { iata: { in: [...ORIGIN_AIRPORTS] } },
    });
    for (const a of airports) {
      fallback.set(a.iata, { city: a.name, country: 'Polska' });
    }
  } catch (err) {
    console.warn('[oneway] could not load Airport fallback table:', err);
  }
  return fallback;
}

async function main() {
  console.log(`[oneway] starting (dry-run: ${DRY_RUN})`);

  const runRecord = DRY_RUN ? null : await prisma.searchRun.create({ data: { status: 'PARTIAL' } });

  try {
    const { from, to, fromKey, toKey } = windowBounds();
    console.log(`[oneway] window: ${fromKey} → ${toKey}`);

    const { routes, airportInfo } = await discover(fromKey, toKey);
    console.log(`[oneway] ${routes.length} unique active routes total`);

    const { rows, failures } = await fetchDetails(routes, from, to, fromKey, toKey);
    const polishFallback = await buildPolishFallback();
    fillAirportNames(rows, airportInfo, polishFallback);

    const outCount = routes.filter((r) => r.direction === 'OUT').length;
    const inCount = routes.filter((r) => r.direction === 'IN').length;
    console.log(
      `[oneway] detail: ${routes.length} routes (OUT=${outCount}, IN=${inCount}), ` +
        `${rows.length} rows, ${failures} failed lookups`,
    );

    if (DRY_RUN) {
      console.log('[oneway] --dry-run: no DB writes. Sample rows:');
      const sampleOut = rows.filter((r) => r.direction === 'OUT').slice(0, 3);
      const sampleIn = rows.filter((r) => r.direction === 'IN').slice(0, 3);
      for (const r of [...sampleOut, ...sampleIn]) {
        console.log(
          `  [${r.direction}] ${r.origin}(${r.originCity})→${r.destination}(${r.destCity}, ${r.destCountry}) ` +
            `${(r.date as Date).toISOString().slice(0, 10)} ${(r.departureTime as Date).toISOString().slice(11, 16)} ` +
            `${r.price} ${r.currency}`,
        );
      }
      return;
    }

    await prisma.$transaction([
      prisma.oneWayFare.deleteMany(),
      ...Array.from({ length: Math.ceil(rows.length / INSERT_CHUNK) }, (_, i) =>
        prisma.oneWayFare.createMany({
          data: rows.slice(i * INSERT_CHUNK, (i + 1) * INSERT_CHUNK),
        }),
      ),
    ]);

    console.log(`[oneway] saved ${rows.length} rows across ${routes.length} routes`);

    await prisma.searchRun.update({
      where: { id: runRecord!.id },
      data: {
        status: 'SUCCESS',
        finishedAt: new Date(),
        dealsFound: rows.length,
        routesQueried: routes.length,
      },
    });
  } catch (err) {
    console.error('[oneway] FAILED:', err);
    if (!DRY_RUN && runRecord) {
      await prisma.searchRun.update({
        where: { id: runRecord.id },
        data: { status: 'FAILED', finishedAt: new Date(), errorMessage: String(err) },
      });
    }
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
