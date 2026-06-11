import { getCheapestPerDay, getDestinations } from './index.js';

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
      console.log(`${origin}→${dest} (${year}-${String(month + 1).padStart(2, '0')}): ${fares.length} days with fares`);
      for (const f of sample) {
        console.log(`  ${f.date} dep=${f.departureTime.slice(11, 16)} arr=${f.arrivalTime.slice(11, 16)} ${f.price} ${f.currency}`);
      }
    } catch (err) {
      console.error(`${origin}→${dest} ERROR:`, err);
    }
    await new Promise((r) => setTimeout(r, 400));
  }
}

main().catch(console.error);
