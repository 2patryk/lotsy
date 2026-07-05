import {
  getCheapestPerDay,
  getDestinations,
  getOneWayFaresList,
  getWizzApiVersion,
  getWizzRoutes,
  getWizzTimetable,
} from './index.ts';

const ROUTES = [
  { origin: 'WMI', dest: 'CIA' },
  { origin: 'KRK', dest: 'BCN' },
  { origin: 'WAW', dest: 'AGP' },
];

const now = new Date();
const year = now.getFullYear();
const month = now.getMonth(); // 0-indexed

async function main() {
  console.log('=== Smoke test: Ryanair destinations ===\n');

  for (const airport of ['WAW', 'WMI', 'KRK']) {
    try {
      const dests = await getDestinations(airport);
      console.log(`${airport} → ${dests.length} destinations: ${dests.slice(0, 10).join(', ')}...`);
    } catch (err) {
      console.error(`${airport} destinations ERROR:`, err);
    }
    await new Promise((r) => setTimeout(r, 400));
  }

  console.log('\n=== Smoke test: cheapestPerDay ===\n');

  for (const { origin, dest } of ROUTES) {
    try {
      const fares = await getCheapestPerDay(origin, dest, year, month);
      const sample = fares.slice(0, 3);
      console.log(
        `${origin}→${dest} (${year}-${String(month + 1).padStart(2, '0')}): ${fares.length} days with fares`,
      );
      for (const f of sample) {
        console.log(
          `  ${f.date} dep=${f.departureTime.slice(11, 16)} arr=${f.arrivalTime.slice(11, 16)} ${f.price} ${f.currency}`,
        );
      }
    } catch (err) {
      console.error(`${origin}→${dest} ERROR:`, err);
    }
    await new Promise((r) => setTimeout(r, 400));
  }

  console.log('\n=== Smoke test: getOneWayFaresList ===\n');

  const today = new Date();
  const to = new Date(today.getTime() + 10 * 86_400_000);
  const dateFrom = today.toISOString().slice(0, 10);
  const dateTo = to.toISOString().slice(0, 10);

  try {
    const outFares = await getOneWayFaresList({
      departureAirportIataCode: 'WAW',
      outboundDepartureDateFrom: dateFrom,
      outboundDepartureDateTo: dateTo,
    });
    console.log(`WAW→ (OUT): ${outFares.length} active routes`);
    for (const f of outFares.slice(0, 3)) {
      console.log(
        `  ${f.origin}→${f.destination} (${f.destCity}, ${f.destCountry}) ${f.date} ${f.departureTime.slice(11, 16)} ${f.price} ${f.currency}`,
      );
    }
  } catch (err) {
    console.error('getOneWayFaresList (OUT) ERROR:', err);
  }

  await new Promise((r) => setTimeout(r, 400));

  try {
    const inFares = await getOneWayFaresList({
      arrivalCountryCode: 'pl',
      departureCountryCode: 'it',
      outboundDepartureDateFrom: dateFrom,
      outboundDepartureDateTo: dateTo,
    });
    console.log(`IT→PL (IN): ${inFares.length} active routes`);
    for (const f of inFares.slice(0, 3)) {
      console.log(
        `  ${f.origin}→${f.destination} (${f.originCity} → ${f.destCity}) ${f.date} ${f.departureTime.slice(11, 16)} ${f.price} ${f.currency}`,
      );
    }
  } catch (err) {
    console.error('getOneWayFaresList (IN) ERROR:', err);
  }

  console.log('\n=== Smoke test: Wizz Air ===\n');

  try {
    const version = await getWizzApiVersion();
    console.log(`Wizz API version: ${version}`);
  } catch (err) {
    console.error('getWizzApiVersion ERROR:', err);
  }

  for (const airport of ['WAW', 'KTW', 'GDN']) {
    try {
      const routes = await getWizzRoutes(airport);
      console.log(`${airport} → ${routes.length} routes: ${routes.slice(0, 10).join(', ')}...`);
    } catch (err) {
      console.error(`${airport} getWizzRoutes ERROR:`, err);
    }
    await new Promise((r) => setTimeout(r, 400));
  }

  const wizzTo = new Date(today.getTime() + 30 * 86_400_000);
  for (const { origin, dest } of [
    { origin: 'WAW', dest: 'CTA' },
    { origin: 'KTW', dest: 'BCN' },
  ]) {
    try {
      const fares = await getWizzTimetable({
        origin,
        destination: dest,
        from: dateFrom,
        to: wizzTo.toISOString().slice(0, 10),
      });
      console.log(`${origin}→${dest} (Wizz): ${fares.length} days with fares`);
      for (const f of fares.slice(0, 3)) {
        console.log(`  ${f.date} dep=${f.departureTime.slice(11, 16)} ${f.price} ${f.currency}`);
      }
    } catch (err) {
      console.error(`${origin}→${dest} getWizzTimetable ERROR:`, err);
    }
    await new Promise((r) => setTimeout(r, 400));
  }
}

main().catch(console.error);
