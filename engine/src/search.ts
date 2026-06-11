import { prisma } from '@lotsy/db';
import { getCheapestPerDay } from '@lotsy/flights-client';
import { buildRouteCache } from './route-cache.js';
import { matchPairs } from './date-matcher.js';
import {
  MAX_TOTAL_PRICE,
  TOP_N_PER_ROUTE,
  HORIZON_WEEKS,
  MAX_CONCURRENT,
  BATCH_DELAY_MS,
  DEAL_TTL_HOURS,
} from './config.js';

const DRY_RUN = process.argv.includes('--dry-run');

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Returns [year, month (0-indexed)] pairs covering the next HORIZON_WEEKS weeks */
function getMonthsToQuery(): Array<{ year: number; month: number }> {
  const months = new Set<string>();
  const now = new Date();

  for (let w = 0; w < HORIZON_WEEKS; w++) {
    const d = new Date(now.getTime() + w * 7 * 86_400_000);
    months.add(`${d.getFullYear()}-${d.getMonth()}`);
  }

  return [...months].map((s) => {
    const [y, m] = s.split('-').map(Number);
    return { year: y, month: m };
  });
}

/** Runs fn on items in batches of MAX_CONCURRENT with BATCH_DELAY_MS between batches */
async function runConcurrent<T, R>(
  items: T[],
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

function buildBookingUrl(
  origin: string,
  destination: string,
  outDate: string,
  retDate: string,
): string {
  return (
    `https://www.ryanair.com/pl/pl/trip/flights/select` +
    `?adults=1&teens=0&children=0&infants=0` +
    `&dateOut=${outDate}&dateIn=${retDate}` +
    `&isConnectedFlight=false&discount=0&promoCode=` +
    `&originIataOut=${origin}&destinationIataOut=${destination}` +
    `&originIataIn=${destination}&destinationIataIn=${origin}` +
    `&tpAdults=1&tpTeens=0&tpChildren=0&tpInfants=0` +
    `&tpStartDate=${outDate}&tpEndDate=${retDate}` +
    `&tpDiscount=0&tpPromoCode=` +
    `&tpOriginIataOut=${origin}&tpDestinationIataOut=${destination}` +
    `&tpOriginIataIn=${destination}&tpDestinationIataIn=${origin}`
  );
}

async function main() {
  console.log(`[engine] Starting search run (dry-run=${DRY_RUN})`);

  const runRecord = DRY_RUN
    ? null
    : await prisma.searchRun.create({
        data: { status: 'PARTIAL' },
      });

  let dealsFound = 0;
  let routesQueried = 0;

  try {
    const routes = await buildRouteCache();
    const months = getMonthsToQuery();

    console.log(`[engine] ${routes.length} routes × ${months.length} months`);

    // Fetch outbound and inbound fares for each route × month
    type FetchTask = { origin: string; destination: string; year: number; month: number; direction: 'out' | 'in' };
    const tasks: FetchTask[] = [];

    for (const { origin, destination } of routes) {
      for (const { year, month } of months) {
        tasks.push({ origin, destination, year, month, direction: 'out' });
        tasks.push({ origin: destination, destination: origin, year, month, direction: 'in' });
      }
    }

    console.log(`[engine] ${tasks.length} fetch tasks`);

    // Fetch all fares
    const fareResults = await runConcurrent(tasks, (t) =>
      getCheapestPerDay(t.origin, t.destination, t.year, t.month),
    );

    // Group by route
    type FaresByRoute = Map<
      string,
      { outbound: import('@lotsy/flights-client').DailyFare[]; inbound: import('@lotsy/flights-client').DailyFare[] }
    >;
    const byRoute: FaresByRoute = new Map();

    for (const { item, result, error } of fareResults) {
      if (error) {
        console.warn(`[engine] fetch error ${item.origin}→${item.destination} ${item.year}-${item.month + 1}:`, error);
        continue;
      }
      const key = item.direction === 'out'
        ? `${item.origin}:${item.destination}`
        : `${item.destination}:${item.origin}`;

      if (!byRoute.has(key)) byRoute.set(key, { outbound: [], inbound: [] });
      const entry = byRoute.get(key)!;

      if (item.direction === 'out') {
        entry.outbound.push(...(result ?? []));
      } else {
        entry.inbound.push(...(result ?? []));
      }
    }

    routesQueried = byRoute.size;
    const now = new Date();
    const minDepartAt = new Date(now.getTime() + 24 * 3600 * 1000); // skip flights < 24h away
    const expiresAt = new Date(now.getTime() + DEAL_TTL_HOURS * 3600 * 1000);

    for (const [routeKey, { outbound, inbound }] of byRoute) {
      const [origin, destination] = routeKey.split(':');
      const pairs = matchPairs(outbound, inbound, MAX_TOTAL_PRICE);

      // Filter out past/near-future departures and take top N
      const topPairs = pairs
        .filter((p) => new Date(p.outbound.departureTime) >= minDepartAt)
        .slice(0, TOP_N_PER_ROUTE);

      for (const pair of topPairs) {
        const departAt = new Date(pair.outbound.departureTime);
        const returnAt = new Date(pair.inbound.departureTime);

        const outboundBookingUrl = buildBookingUrl(origin, destination, pair.outbound.date, pair.inbound.date);
        const returnBookingUrl = null;

        const dealData = {
          mixedCarrier: false,
          originAirport: origin,
          originCountry: 'PL',
          departAt,
          destAirport: destination,
          destCountry: pair.outbound.destination === destination
            ? getCountryForAirport(destination)
            : getCountryForAirport(pair.inbound.origin),
          returnAt,
          nights: pair.nights,
          totalPrice: pair.totalPrice,
          currency: pair.outbound.currency,
          pricePerPerson: pair.totalPrice,
          outboundSource: pair.outbound.source,
          outboundAirline: pair.outbound.airline,
          outboundPrice: pair.outbound.price,
          outboundFlightNo: null,
          outboundStops: 0,
          outboundBookingUrl,
          returnSource: pair.inbound.source,
          returnAirline: pair.inbound.airline,
          returnPrice: pair.inbound.price,
          returnFlightNo: null,
          returnStops: 0,
          returnBookingUrl,
          expiresAt,
        };

        if (DRY_RUN) {
          console.log(
            `[dry-run] ${origin}→${destination} ${pair.outbound.date}→${pair.inbound.date}` +
            ` ${pair.nights}n ${pair.totalPrice.toFixed(0)} PLN`,
          );
          dealsFound++;
          continue;
        }

        try {
          await prisma.deal.upsert({
            where: {
              originAirport_destAirport_departAt_returnAt_outboundSource_returnSource: {
                originAirport: origin,
                destAirport: destination,
                departAt,
                returnAt,
                outboundSource: pair.outbound.source,
                returnSource: pair.inbound.source,
              },
            },
            update: {
              totalPrice: dealData.totalPrice,
              pricePerPerson: dealData.pricePerPerson,
              outboundPrice: dealData.outboundPrice,
              returnPrice: dealData.returnPrice,
              outboundBookingUrl: dealData.outboundBookingUrl,
              returnBookingUrl: dealData.returnBookingUrl,
              expiresAt,
            },
            create: dealData,
          });
          dealsFound++;
        } catch (err) {
          console.error(`[engine] upsert error ${routeKey}:`, err);
        }
      }
    }

    // Clean up expired and past deals
    if (!DRY_RUN) {
      const deleted = await prisma.deal.deleteMany({
        where: {
          OR: [{ expiresAt: { lt: now } }, { departAt: { lt: now } }],
        },
      });
      console.log(`[engine] Cleaned ${deleted.count} expired/past deals`);

      await prisma.searchRun.update({
        where: { id: runRecord!.id },
        data: { status: 'SUCCESS', finishedAt: new Date(), dealsFound, routesQueried },
      });
    }

    console.log(`[engine] Done. deals=${dealsFound} routes=${routesQueried}`);
  } catch (err) {
    console.error('[engine] Fatal error:', err);

    if (!DRY_RUN && runRecord) {
      await prisma.searchRun.update({
        where: { id: runRecord.id },
        data: {
          status: 'FAILED',
          finishedAt: new Date(),
          dealsFound,
          routesQueried,
          errorMessage: String(err),
        },
      });
    }

    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Country lookup for destination airports
function getCountryForAirport(iata: string): string {
  const map: Record<string, string> = {
    FCO: 'IT', MXP: 'IT', NAP: 'IT', BLQ: 'IT', VCE: 'IT', PSA: 'IT',
    BCN: 'ES', MAD: 'ES', AGP: 'ES', PMI: 'ES', ALC: 'ES', SVQ: 'ES',
    ATH: 'GR', HER: 'GR', RHO: 'GR', SKG: 'GR', CFU: 'GR',
    SPU: 'HR', DBV: 'HR', ZAD: 'HR',
    TIA: 'AL',
    TGD: 'ME', TIV: 'ME',
    LIS: 'PT', OPO: 'PT', FAO: 'PT',
    MLA: 'MT',
    LCA: 'CY', PFO: 'CY',
    AYT: 'TR', IST: 'TR', ESB: 'TR',
    VAR: 'BG', BOJ: 'BG',
    NCE: 'FR', MRS: 'FR',
  };
  return map[iata] ?? 'XX';
}

main();
