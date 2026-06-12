import { prisma } from '@lotsy/db';
import { getDestinations } from '@lotsy/flights-client';
import { ORIGIN_AIRPORTS, DEST_AIRPORTS, BATCH_DELAY_MS, ROUTE_CACHE_TTL_HOURS } from './config.js';

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export interface ReturnOption {
  airport: string;
  /** 1 = same airport, 2 = same metro area, 3 = different PL city (open-jaw) */
  level: 1 | 2 | 3;
}

export interface RouteCache {
  routes: Array<{ origin: string; destination: string }>;
  /** For each destination: sorted list of valid PL return airports with level */
  destToReturnOptions: Map<string, ReturnOption[]>;
  savedAt: Date;
}

// Airports considered the same metro area for Level-2 pairing
const METRO_GROUPS: string[][] = [
  ['WAW', 'WMI'], // Warsaw Chopin + Warsaw Modlin
  ['KRK', 'KTW'], // Kraków + Katowice
];

function getLevel(origin: string, returnAirport: string): 1 | 2 | 3 {
  if (origin === returnAirport) return 1;
  if (METRO_GROUPS.some((g) => g.includes(origin) && g.includes(returnAirport))) return 2;
  return 3;
}

type DestMapEntry = { dest: string; options: Array<{ airport: string; level: 1 | 2 | 3 }> };

function deserialize(raw: { routes: unknown; destMap: unknown; savedAt: Date }): RouteCache {
  const routes = raw.routes as Array<{ origin: string; destination: string }>;
  const destMapArr = raw.destMap as DestMapEntry[];
  const destToReturnOptions = new Map<string, ReturnOption[]>(
    destMapArr.map((e) => [e.dest, e.options]),
  );
  return { routes, destToReturnOptions, savedAt: raw.savedAt };
}

export async function loadRouteCache(): Promise<RouteCache | null> {
  const row = await prisma.routeCache.findUnique({ where: { id: 'main' } });
  if (!row) return null;

  const ageMs = Date.now() - row.savedAt.getTime();
  if (ageMs > ROUTE_CACHE_TTL_HOURS * 3_600_000) return null;

  return deserialize(row as { routes: unknown; destMap: unknown; savedAt: Date });
}

export async function fetchAndSaveRouteCache(): Promise<RouteCache> {
  console.log('[routes] Fetching routes from Ryanair…');

  const routes: Array<{ origin: string; destination: string }> = [];
  // dest → set of PL airports that directly serve it
  const destToOriginSet = new Map<string, Set<string>>();

  for (const origin of ORIGIN_AIRPORTS) {
    try {
      const dests = await getDestinations(origin);
      const matched = dests.filter((d) => DEST_AIRPORTS.has(d));
      for (const destination of matched) {
        routes.push({ origin, destination });
        if (!destToOriginSet.has(destination)) destToOriginSet.set(destination, new Set());
        destToOriginSet.get(destination)!.add(origin);
      }
      console.log(`[routes] ${origin}: ${matched.length}/${dests.length} matched`);
    } catch (err) {
      console.error(`[routes] ${origin} ERROR:`, err);
    }
    await sleep(BATCH_DELAY_MS);
  }

  // Build return-option lists with levels
  const destToReturnOptions = new Map<string, ReturnOption[]>();
  const destMapArr: DestMapEntry[] = [];

  for (const [dest, origins] of destToOriginSet) {
    const options: ReturnOption[] = [];
    for (const origin of origins) {
      // Every airport in `origins` is a valid return airport for any outbound origin.
      // Assign level based on the relationship to the outbound origin.
      // We store one entry per (outboundOrigin, returnAirport) pair here:
      // actually we store all possible return airports for a destination —
      // the level is computed per-pair in search.ts using getLevel().
      options.push({ airport: origin, level: 1 }); // placeholder; real level set in search.ts
    }
    destToReturnOptions.set(dest, options);
    destMapArr.push({
      dest,
      options: options.map((o) => ({ airport: o.airport, level: o.level })),
    });
  }

  const savedAt = new Date();

  await prisma.routeCache.upsert({
    where: { id: 'main' },
    update: { savedAt, routes, destMap: destMapArr },
    create: { id: 'main', savedAt, routes, destMap: destMapArr },
  });

  console.log(`[routes] Saved ${routes.length} routes, ${destToReturnOptions.size} destinations`);
  return { routes, destToReturnOptions, savedAt };
}

/** Returns cached routes if fresh, otherwise re-fetches from Ryanair */
export async function getOrFetchRouteCache(): Promise<RouteCache> {
  const cached = await loadRouteCache();
  if (cached) {
    const ageMin = Math.round((Date.now() - cached.savedAt.getTime()) / 60_000);
    console.log(`[routes] Using cached routes (${ageMin} min old, ${cached.routes.length} routes)`);
    return cached;
  }
  return fetchAndSaveRouteCache();
}

/** Exposed for use in search.ts to classify return options per outbound origin */
export { getLevel };
