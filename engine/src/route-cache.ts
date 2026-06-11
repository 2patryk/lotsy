import { getDestinations } from '@lotsy/flights-client';
import { ORIGIN_AIRPORTS, DEST_AIRPORTS, BATCH_DELAY_MS } from './config.js';

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export interface RouteCache {
  routes: Array<{ origin: string; destination: string }>;
  /** For each destination, which Polish airports have a route to it. Used for open-jaw inbound planning. */
  destToOrigins: Map<string, string[]>;
}

/**
 * Fetches real routes from Ryanair for all Polish origin airports,
 * filtered to only destination airports in our target list.
 * Also builds a reverse map (dest → [polishAirports]) for open-jaw pairing.
 */
export async function buildRouteCache(): Promise<RouteCache> {
  const routes: Array<{ origin: string; destination: string }> = [];
  const destToOrigins = new Map<string, string[]>();

  for (const origin of ORIGIN_AIRPORTS) {
    try {
      const dests = await getDestinations(origin);
      const matched = dests.filter((d) => DEST_AIRPORTS.has(d));
      for (const destination of matched) {
        routes.push({ origin, destination });
        if (!destToOrigins.has(destination)) destToOrigins.set(destination, []);
        destToOrigins.get(destination)!.push(origin);
      }
      console.log(`[routes] ${origin}: ${matched.length}/${dests.length} matching destinations`);
    } catch (err) {
      console.error(`[routes] ${origin} ERROR:`, err);
    }
    await sleep(BATCH_DELAY_MS);
  }

  console.log(`[routes] Total routes: ${routes.length}`);
  return { routes, destToOrigins };
}
