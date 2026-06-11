import { getDestinations } from '@lotsy/flights-client';
import { ORIGIN_AIRPORTS, DEST_AIRPORTS, BATCH_DELAY_MS } from './config.js';

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Fetches real routes from Ryanair for all Polish origin airports,
 * filtered to only destination airports in our target list.
 * Returns a flat list of { origin, destination } pairs.
 */
export async function buildRouteCache(): Promise<Array<{ origin: string; destination: string }>> {
  const routes: Array<{ origin: string; destination: string }> = [];

  for (const origin of ORIGIN_AIRPORTS) {
    try {
      const dests = await getDestinations(origin);
      const matched = dests.filter((d) => DEST_AIRPORTS.has(d));
      for (const destination of matched) {
        routes.push({ origin, destination });
      }
      console.log(`[routes] ${origin}: ${matched.length}/${dests.length} matching destinations`);
    } catch (err) {
      console.error(`[routes] ${origin} ERROR:`, err);
    }
    await sleep(BATCH_DELAY_MS);
  }

  console.log(`[routes] Total routes: ${routes.length}`);
  return routes;
}
