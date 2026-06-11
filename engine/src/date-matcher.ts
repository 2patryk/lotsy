import type { DailyFare } from '@lotsy/flights-client';

export interface FarePair {
  outbound: DailyFare;
  inbound: DailyFare;
  nights: number;
  totalPrice: number;
  score: number;
}

// Valid outbound weekdays: Thursday=4, Friday=5, Saturday=6
const OUTBOUND_DAYS = new Set([4, 5, 6]);

// Valid return weekdays: Sunday=0, Monday=1, Saturday=6
const RETURN_DAYS = new Set([0, 1, 6]);

const MIN_NIGHTS = 3;
const MAX_NIGHTS = 7;

function dayOfWeek(dateStr: string): number {
  return new Date(dateStr + 'T00:00:00').getDay();
}

function nightsBetween(outDate: string, retDate: string): number {
  const a = new Date(outDate + 'T00:00:00').getTime();
  const b = new Date(retDate + 'T00:00:00').getTime();
  return Math.round((b - a) / 86_400_000);
}

function hourOf(dateTimeStr: string): number {
  return parseInt(dateTimeStr.slice(11, 13), 10);
}

/**
 * Soft score: lower is better (used for sorting).
 * Good-hour flights get a bonus that reduces their effective price.
 */
function scoreBonus(outbound: DailyFare, inbound: DailyFare): number {
  const outHour = hourOf(outbound.departureTime);
  const retHour = hourOf(inbound.departureTime);
  const outDay = dayOfWeek(outbound.date);
  const retDay = dayOfWeek(inbound.date);

  let bonus = 0;

  // Good outbound hours
  if (outDay === 4 && outHour >= 16) bonus += 20; // Thu evening
  if (outDay === 5) bonus += 15;                  // Fri any
  if (outDay === 6 && outHour <= 12) bonus += 10; // Sat morning

  // Good return hours
  if ((retDay === 0 || retDay === 1) && retHour >= 16) bonus += 20; // Sun/Mon evening
  if (retDay === 6 && retHour >= 14) bonus += 10;                   // Sat afternoon

  return bonus;
}

/**
 * Pairs outbound and inbound fares by the date pattern:
 * outbound on Thu/Fri/Sat, return on Sun/Mon/Sat, 3-7 nights apart.
 * Returns pairs sorted by ascending score (best first).
 */
export function matchPairs(
  outboundFares: DailyFare[],
  inboundFares: DailyFare[],
  maxTotalPrice: number,
): FarePair[] {
  const pairs: FarePair[] = [];

  const retByDate = new Map<string, DailyFare>();
  for (const f of inboundFares) {
    if (RETURN_DAYS.has(dayOfWeek(f.date))) {
      retByDate.set(f.date, f);
    }
  }

  for (const out of outboundFares) {
    if (!OUTBOUND_DAYS.has(dayOfWeek(out.date))) continue;

    const outDateMs = new Date(out.date + 'T00:00:00').getTime();

    for (let n = MIN_NIGHTS; n <= MAX_NIGHTS; n++) {
      const retDate = new Date(outDateMs + n * 86_400_000).toISOString().slice(0, 10);
      const ret = retByDate.get(retDate);
      if (!ret) continue;

      const totalPrice = out.price + ret.price;
      if (totalPrice > maxTotalPrice) continue;

      const bonus = scoreBonus(out, ret);
      const score = totalPrice - bonus;

      pairs.push({
        outbound: out,
        inbound: ret,
        nights: n,
        totalPrice,
        score,
      });
    }
  }

  return pairs.sort((a, b) => a.score - b.score);
}
