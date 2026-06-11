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

/**
 * Builds a Ryanair trip-select URL with both outbound and return legs.
 * Format validated against: originIataOut→destinationIataOut / originIataIn→destinationIataIn
 * For regular round-trips: retOrigin = outDest, retDest = outOrigin
 * For open-jaw: retOrigin = outDest, retDest = different Polish airport
 */
function buildBookingUrl(
  outOrigin: string,
  outDest: string,
  retDest: string,
  outDate: string,
  retDate: string,
): string {
  const retOrigin = outDest;
  return (
    `https://www.ryanair.com/pl/pl/trip/flights/select` +
    `?adults=1&teens=0&children=0&infants=0` +
    `&dateOut=${outDate}&dateIn=${retDate}` +
    `&discount=0&isReturn=false&promoCode=` +
    `&originIataOut=${outOrigin}&destinationIataOut=${outDest}` +
    `&originIataIn=${retOrigin}&destinationIataIn=${retDest}` +
    `&tpAdults=1&tpTeens=0&tpChildren=0&tpInfants=0` +
    `&tpStartDate=${outDate}&tpEndDate=${retDate}` +
    `&tpDiscount=0&tpPromoCode=` +
    `&tpOriginIataOut=${outOrigin}&tpDestinationIataOut=${outDest}` +
    `&tpOriginIataIn=${retOrigin}&tpDestinationIataIn=${retDest}`
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
    const { routes, destToOrigins } = await buildRouteCache();
    const months = getMonthsToQuery();

    console.log(`[engine] ${routes.length} routes × ${months.length} months`);

    type FetchTask = { from: string; to: string; year: number; month: number };
    const tasks: FetchTask[] = [];
    const outboundKeys = new Set<string>();
    const inboundKeys = new Set<string>();

    for (const { origin, destination } of routes) {
      for (const { year, month } of months) {
        const outKey = `${origin}:${destination}:${year}:${month}`;
        if (!outboundKeys.has(outKey)) {
          outboundKeys.add(outKey);
          tasks.push({ from: origin, to: destination, year, month });
        }
      }
    }

    // Collect unique inbound legs: dest → each Polish airport that serves it
    const inboundPairs = new Set<string>();
    for (const { destination } of routes) {
      const returnAirports = destToOrigins.get(destination) ?? [];
      for (const returnAirport of returnAirports) {
        const pairKey = `${destination}:${returnAirport}`;
        if (!inboundPairs.has(pairKey)) {
          inboundPairs.add(pairKey);
          for (const { year, month } of months) {
            const inKey = `${destination}:${returnAirport}:${year}:${month}`;
            if (!inboundKeys.has(inKey)) {
              inboundKeys.add(inKey);
              tasks.push({ from: destination, to: returnAirport, year, month });
            }
          }
        }
      }
    }

    console.log(`[engine] ${tasks.length} fetch tasks (${outboundKeys.size} outbound, ${inboundKeys.size} inbound)`);

    // Fetch all fares
    const fareResults = await runConcurrent(tasks, (t) =>
      getCheapestPerDay(t.from, t.to, t.year, t.month),
    );

    // Store fares by "from:to" key
    type DailyFareList = import('@lotsy/flights-client').DailyFare[];
    const faresByLeg = new Map<string, DailyFareList>();

    for (const { item, result, error } of fareResults) {
      if (error) {
        console.warn(`[engine] fetch error ${item.from}→${item.to} ${item.year}-${item.month + 1}:`, error);
        continue;
      }
      const key = `${item.from}:${item.to}`;
      if (!faresByLeg.has(key)) faresByLeg.set(key, []);
      faresByLeg.get(key)!.push(...(result ?? []));
    }

    routesQueried = routes.length;
    const now = new Date();
    const minDepartAt = new Date(now.getTime() + 24 * 3600 * 1000);
    const expiresAt = new Date(now.getTime() + DEAL_TTL_HOURS * 3600 * 1000);

    for (const { origin, destination } of routes) {
      const outFares = faresByLeg.get(`${origin}:${destination}`) ?? [];
      const returnAirports = destToOrigins.get(destination) ?? [origin];

      for (const returnAirport of returnAirports) {
        const inFares = faresByLeg.get(`${destination}:${returnAirport}`) ?? [];
        const openJaw = returnAirport !== origin;

        const pairs = matchPairs(outFares, inFares, MAX_TOTAL_PRICE);
        const topPairs = pairs
          .filter((p) => new Date(p.outbound.departureTime) >= minDepartAt)
          .slice(0, TOP_N_PER_ROUTE);

        for (const pair of topPairs) {
          const departAt = new Date(pair.outbound.departureTime);
          const returnAt = new Date(pair.inbound.departureTime);

          const bookingUrl = buildBookingUrl(origin, destination, returnAirport, pair.outbound.date, pair.inbound.date);

          const dealData = {
            mixedCarrier: false,
            openJaw,
            originAirport: origin,
            originCountry: 'PL',
            departAt,
            destAirport: destination,
            destCountry: getCountryForAirport(destination),
            returnAt,
            returnAirport,
            nights: pair.nights,
            totalPrice: pair.totalPrice,
            currency: pair.outbound.currency,
            pricePerPerson: pair.totalPrice,
            outboundSource: pair.outbound.source,
            outboundAirline: pair.outbound.airline,
            outboundPrice: pair.outbound.price,
            outboundFlightNo: null,
            outboundStops: 0,
            outboundBookingUrl: bookingUrl,
            returnSource: pair.inbound.source,
            returnAirline: pair.inbound.airline,
            returnPrice: pair.inbound.price,
            returnFlightNo: null,
            returnStops: 0,
            returnBookingUrl: bookingUrl,
            expiresAt,
          };

          if (DRY_RUN) {
            console.log(
              `[dry-run] ${origin}→${destination}→${returnAirport}` +
              ` ${pair.outbound.date}→${pair.inbound.date}` +
              ` ${pair.nights}n ${pair.totalPrice.toFixed(0)} PLN` +
              (openJaw ? ' [open-jaw]' : ''),
            );
            dealsFound++;
            continue;
          }

          try {
            await prisma.deal.upsert({
              where: {
                originAirport_destAirport_departAt_returnAt_outboundSource_returnSource_returnAirport: {
                  originAirport: origin,
                  destAirport: destination,
                  departAt,
                  returnAt,
                  outboundSource: pair.outbound.source,
                  returnSource: pair.inbound.source,
                  returnAirport,
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
            console.error(`[engine] upsert error ${origin}→${destination}→${returnAirport}:`, err);
          }
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

function getCountryForAirport(iata: string): string {
  const map: Record<string, string> = {
    // Italy
    FCO: 'IT', CIA: 'IT', MXP: 'IT', BGY: 'IT', NAP: 'IT', BLQ: 'IT',
    VCE: 'IT', TSF: 'IT', PSA: 'IT', BRI: 'IT', CTA: 'IT', PMO: 'IT',
    OLB: 'IT', CAG: 'IT',
    // Spain (mainland + Balearics)
    BCN: 'ES', MAD: 'ES', AGP: 'ES', PMI: 'ES', ALC: 'ES', SVQ: 'ES',
    VLC: 'ES', IBZ: 'ES', MAH: 'ES',
    // Spain (Canary Islands)
    TFS: 'ES', LPA: 'ES', FUE: 'ES', ACE: 'ES', SPC: 'ES',
    // Greece
    ATH: 'GR', HER: 'GR', RHO: 'GR', SKG: 'GR', CFU: 'GR', KGS: 'GR',
    ZTH: 'GR', JMK: 'GR', MJT: 'GR', CHQ: 'GR', JTR: 'GR',
    // Croatia
    SPU: 'HR', DBV: 'HR', ZAD: 'HR', PUY: 'HR',
    // Albania
    TIA: 'AL',
    // Montenegro
    TGD: 'ME', TIV: 'ME',
    // Portugal
    LIS: 'PT', OPO: 'PT', FAO: 'PT',
    // Malta
    MLA: 'MT',
    // Cyprus
    LCA: 'CY', PFO: 'CY', ECN: 'CY',
    // Turkey
    AYT: 'TR', IST: 'TR', SAW: 'TR', ESB: 'TR', ADB: 'TR', DLM: 'TR', BJV: 'TR',
    // Bulgaria
    VAR: 'BG', BOJ: 'BG',
    // France (south + Corsica)
    NCE: 'FR', MRS: 'FR', AJA: 'FR', FSC: 'FR',
    // Morocco
    RAK: 'MA', AGA: 'MA', CMN: 'MA', FEZ: 'MA', TNG: 'MA',
    // Israel
    TLV: 'IL',
    // Jordan
    AMM: 'JO',
    // Tunisia
    TUN: 'TN', DJE: 'TN', MIR: 'TN',
    // Serbia
    BEG: 'RS',
    // Romania
    OTP: 'RO', CLJ: 'RO', TSR: 'RO', IAS: 'RO',
    // Bosnia & Herzegovina
    SJJ: 'BA',
    // North Macedonia
    SKP: 'MK',
    // Kosovo
    PRN: 'XK',
    // UK
    STN: 'GB', LTN: 'GB', MAN: 'GB', EDI: 'GB', BRS: 'GB', BHX: 'GB', GLA: 'GB',
    // Ireland
    DUB: 'IE', ORK: 'IE', KIR: 'IE',
    // Iceland
    KEF: 'IS',
  };
  return map[iata] ?? 'XX';
}

main();
