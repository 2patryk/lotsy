import { prisma, type Prisma } from '@lotsy/db';
import {
  getCheapestPerDay,
  getOneWayFaresList,
  getWizzRoutes,
  getWizzTimetable,
  type DailyFare,
  getPlnRates,
  toPln,
} from '@lotsy/flights-client';
import {
  ORIGIN_AIRPORTS,
  MAX_CONCURRENT,
  BATCH_DELAY_MS,
  ONEWAY_HORIZON_DAYS,
  ENABLE_WIZZ,
  WIZZ_MAX_CONCURRENT,
  WIZZ_BATCH_DELAY_MS,
  DEST_AIRPORTS,
} from './config.js';

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

// Neon (free tier) suspends the compute after a few idle minutes, which drops
// our connection during the long fetch phase (Postgres 57P01). Reconnect and
// retry the DB op a couple of times before giving up.
async function withDbRetry<T>(op: () => Promise<T>, label: string): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await op();
    } catch (err) {
      const msg = String(err);
      const dropped =
        msg.includes('57P01') || msg.includes('Closed the connection') || msg.includes('P1017');
      if (!dropped || attempt >= 2) throw err;
      console.warn(`[oneway] DB ${label}: connection dropped, reconnecting (retry ${attempt + 1})`);
      try {
        await prisma.$disconnect();
      } catch {
        /* ignore */
      }
      await prisma.$connect();
    }
  }
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
  ryanair: boolean;
  wizz: boolean;
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
  concurrency: number = MAX_CONCURRENT,
  delayMs: number = BATCH_DELAY_MS,
): Promise<Array<{ item: T; result?: R; error?: unknown }>> {
  const results: Array<{ item: T; result?: R; error?: unknown }> = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const settled = await Promise.allSettled(batch.map(fn));
    for (let j = 0; j < batch.length; j++) {
      const s = settled[j];
      results.push(
        s.status === 'fulfilled'
          ? { item: batch[j], result: s.value }
          : { item: batch[j], error: s.reason },
      );
    }
    if (i + concurrency < items.length) await sleep(delayMs);
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
      routes.push({
        origin: f.origin,
        destination: f.destination,
        direction: 'OUT',
        ryanair: true,
        wizz: false,
      });
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
      routes.push({
        origin: f.origin,
        destination: f.destination,
        direction: 'IN',
        ryanair: true,
        wizz: false,
      });
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

// Phase 1c: fold Wizz Air into the route set. Flags Ryanair routes that Wizz
// also serves (so the detail phase pools both), and appends Wizz-only routes.
// Returns whether Wizz is usable this run — if every route-map call fails
// (e.g. IP block), we disable Wizz and keep going on Ryanair alone.
async function mergeWizzRoutes(
  routes: Route[],
  airportInfo: Map<string, AirportInfo>,
): Promise<{ routes: Route[]; wizzEnabled: boolean }> {
  const wizzResults = await runConcurrent(
    ORIGIN_AIRPORTS as readonly string[],
    (origin) => getWizzRoutes(origin),
    WIZZ_MAX_CONCURRENT,
    WIZZ_BATCH_DELAY_MS,
  );

  // PL airport -> set of destinations Wizz flies from it (routes are bidirectional).
  const wizzByPL = new Map<string, Set<string>>();
  let failures = 0;
  for (const { item: origin, result, error } of wizzResults) {
    if (error) {
      failures++;
      console.warn(`[oneway] Wizz routes failed for ${origin}:`, error);
      continue;
    }
    wizzByPL.set(origin, new Set((result ?? []).filter((d) => DEST_AIRPORTS.has(d))));
  }

  if (failures === ORIGIN_AIRPORTS.length) {
    console.warn('[oneway] Wizz route discovery fully failed — disabling Wizz for this run');
    return { routes, wizzEnabled: false };
  }

  const servesWizz = (route: Route): boolean =>
    route.direction === 'OUT'
      ? (wizzByPL.get(route.origin)?.has(route.destination) ?? false)
      : (wizzByPL.get(route.destination)?.has(route.origin) ?? false);

  // Flag existing Ryanair routes that Wizz also flies.
  for (const route of routes) {
    if (servesWizz(route)) route.wizz = true;
  }

  // Append Wizz-only routes (both directions), skipping pairs already present.
  const seen = new Set(routes.map((r) => `${r.origin}:${r.destination}`));
  let added = 0;
  for (const [pl, dests] of wizzByPL) {
    for (const dest of dests) {
      const outKey = `${pl}:${dest}`;
      if (!seen.has(outKey)) {
        seen.add(outKey);
        routes.push({
          origin: pl,
          destination: dest,
          direction: 'OUT',
          ryanair: false,
          wizz: true,
        });
        added++;
      }
      const inKey = `${dest}:${pl}`;
      if (!seen.has(inKey)) {
        seen.add(inKey);
        routes.push({ origin: dest, destination: pl, direction: 'IN', ryanair: false, wizz: true });
        added++;
      }
    }
  }

  const overlap = routes.filter((r) => r.ryanair && r.wizz).length;
  console.log(
    `[oneway] Wizz merge: ${failures} route-map failures, ${overlap} shared routes, ` +
      `${added} Wizz-only routes added`,
  );
  // airportInfo for Wizz-only foreign airports may be missing; fillAirportNames
  // falls back to the IATA code. Overlap with Ryanair covers the common case.
  void airportInfo;

  return { routes, wizzEnabled: true };
}

// Phase 2: per-day cheapest fare for every active route, pooling Ryanair and
// Wizz (mix & match) — for each route+day we keep whichever carrier is cheaper.
async function fetchDetails(
  routes: Route[],
  from: Date,
  to: Date,
  fromKey: string,
  toKey: string,
  wizzEnabled: boolean,
): Promise<{ rows: OneWayFareRow[]; ryanairFailures: number; wizzFailures: number }> {
  const months = monthsInWindow(from, to);
  const dirOf = new Map<string, 'OUT' | 'IN'>(
    routes.map((r) => [`${r.origin}:${r.destination}`, r.direction]),
  );

  // Wizz prices come in the departure country's currency (EUR/GBP/…), so
  // normalize every fare to PLN before comparing or storing.
  const rates = await getPlnRates();
  let droppedFx = 0;
  let droppedUnknownRoute = 0;

  // Cheapest fare seen so far per (origin, destination, day). Ties keep the
  // first carrier (Ryanair, since it runs first) — good enough, both are valid.
  const best = new Map<string, DailyFare>();
  const consider = (f: DailyFare) => {
    if (f.date < fromKey || f.date > toKey) return;
    // Wizz sometimes answers with flights for a nearby station instead of the
    // one requested (e.g. BBU for OTP). Such fares have no route entry, and
    // guessing a direction would leak foreign airports into the Polish-side
    // filter list — drop them instead.
    if (!dirOf.has(`${f.origin}:${f.destination}`)) {
      droppedUnknownRoute++;
      return;
    }
    const pln = toPln(f.price, f.currency, rates);
    if (pln == null) {
      droppedFx++;
      return; // unknown currency — don't pollute the min() with a raw amount
    }
    const key = `${f.origin}:${f.destination}:${f.date}`;
    const cur = best.get(key);
    if (!cur || pln < cur.price) best.set(key, { ...f, price: pln, currency: 'PLN' });
  };

  // Ryanair: one call per route+month.
  type RyanTask = { route: Route; year: number; month: number };
  const ryanTasks: RyanTask[] = [];
  for (const route of routes) {
    if (!route.ryanair) continue;
    for (const { year, month } of months) ryanTasks.push({ route, year, month });
  }

  let ryanairFailures = 0;
  const ryanResults = await runConcurrent(ryanTasks, (t) =>
    getCheapestPerDay(t.route.origin, t.route.destination, t.year, t.month),
  );
  for (const { item, result, error } of ryanResults) {
    if (error) {
      ryanairFailures++;
      console.warn(
        `[oneway] Ryanair cheapestPerDay failed for ${item.route.origin}→${item.route.destination} ` +
          `${item.year}-${item.month + 1}:`,
        error,
      );
      continue;
    }
    for (const f of result ?? []) consider(f);
  }

  // Wizz: one call per route covers the whole window (client splits into 42-day
  // sub-windows internally).
  let wizzFailures = 0;
  if (wizzEnabled) {
    const wizzRoutes = routes.filter((r) => r.wizz);
    const wizzResults = await runConcurrent(
      wizzRoutes,
      (r) =>
        getWizzTimetable({
          origin: r.origin,
          destination: r.destination,
          from: fromKey,
          to: toKey,
        }),
      WIZZ_MAX_CONCURRENT,
      WIZZ_BATCH_DELAY_MS,
    );
    for (const { item, result, error } of wizzResults) {
      if (error) {
        wizzFailures++;
        console.warn(
          `[oneway] Wizz timetable failed for ${item.origin}→${item.destination}:`,
          error,
        );
        continue;
      }
      for (const f of result ?? []) consider(f);
    }
  }

  const rows: OneWayFareRow[] = [];
  let droppedNonPln = 0;
  for (const f of best.values()) {
    // Belt-and-braces: consider() normalizes everything to PLN, so a non-PLN
    // fare here means a conversion bug upstream — never let it reach the DB.
    if (f.currency !== 'PLN') {
      droppedNonPln++;
      continue;
    }
    rows.push({
      // consider() already rejected fares without a route entry, so this is
      // always defined.
      direction: dirOf.get(`${f.origin}:${f.destination}`)!,
      origin: f.origin,
      originCity: '', // filled in by caller once airport names are known
      originCountry: '',
      destination: f.destination,
      destCity: '',
      destCountry: '',
      date: new Date(`${f.date}T00:00:00Z`),
      departureTime: new Date(f.departureTime),
      arrivalTime: new Date(f.arrivalTime),
      flightNumber: null,
      price: f.price,
      currency: f.currency,
      source: f.source,
      airline: f.airline,
    });
  }

  if (droppedFx > 0) {
    console.warn(`[oneway] dropped ${droppedFx} fares with unconvertible currency`);
  }
  if (droppedNonPln > 0) {
    console.warn(`[oneway] dropped ${droppedNonPln} non-PLN rows before insert (conversion bug?)`);
  }
  if (droppedUnknownRoute > 0) {
    console.warn(`[oneway] dropped ${droppedUnknownRoute} fares for stations we did not ask about`);
  }

  return { rows, ryanairFailures, wizzFailures };
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

  // Created just before the write, not here — opening it now would leave the
  // connection idle through the long fetch phase and Neon would drop it.
  let runRecord: { id: string } | null = null;

  try {
    const { from, to, fromKey, toKey } = windowBounds();
    console.log(`[oneway] window: ${fromKey} → ${toKey}`);

    const discovery = await discover(fromKey, toKey);
    let routes = discovery.routes;
    const airportInfo = discovery.airportInfo;
    console.log(`[oneway] ${routes.length} Ryanair active routes`);

    let wizzEnabled = false;
    if (ENABLE_WIZZ) {
      const merged = await mergeWizzRoutes(routes, airportInfo);
      routes = merged.routes;
      wizzEnabled = merged.wizzEnabled;
    }
    console.log(`[oneway] ${routes.length} unique active routes total (Wizz: ${wizzEnabled})`);

    const { rows, ryanairFailures, wizzFailures } = await fetchDetails(
      routes,
      from,
      to,
      fromKey,
      toKey,
      wizzEnabled,
    );
    const polishFallback = await buildPolishFallback();
    fillAirportNames(rows, airportInfo, polishFallback);

    const outCount = routes.filter((r) => r.direction === 'OUT').length;
    const inCount = routes.filter((r) => r.direction === 'IN').length;
    const wizzRows = rows.filter((r) => r.source === 'WIZZAIR').length;
    console.log(
      `[oneway] detail: ${routes.length} routes (OUT=${outCount}, IN=${inCount}), ` +
        `${rows.length} rows (${wizzRows} Wizz-cheapest), ` +
        `${ryanairFailures} Ryanair + ${wizzFailures} Wizz failed lookups`,
    );

    if (DRY_RUN) {
      console.log('[oneway] --dry-run: no DB writes. Sample rows:');
      const sampleOut = rows.filter((r) => r.direction === 'OUT').slice(0, 3);
      const sampleIn = rows.filter((r) => r.direction === 'IN').slice(0, 3);
      for (const r of [...sampleOut, ...sampleIn]) {
        console.log(
          `  [${r.direction}] ${r.origin}(${r.originCity})→${r.destination}(${r.destCity}, ${r.destCountry}) ` +
            `${(r.date as Date).toISOString().slice(0, 10)} ${(r.departureTime as Date).toISOString().slice(11, 16)} ` +
            `${r.price} ${r.currency} [${r.source}]`,
        );
      }
      return;
    }

    runRecord = await withDbRetry(
      () => prisma.searchRun.create({ data: { status: 'PARTIAL' } }),
      'searchRun.create',
    );

    await withDbRetry(
      () =>
        prisma.$transaction([
          prisma.oneWayFare.deleteMany(),
          ...Array.from({ length: Math.ceil(rows.length / INSERT_CHUNK) }, (_, i) =>
            prisma.oneWayFare.createMany({
              data: rows.slice(i * INSERT_CHUNK, (i + 1) * INSERT_CHUNK),
            }),
          ),
        ]),
      'oneWayFare write',
    );

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
