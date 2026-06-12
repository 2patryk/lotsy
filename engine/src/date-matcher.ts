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

// Hard minimum hour for return flights per weekday (plan: "złoty wzorzec")
const RETURN_MIN_HOUR: Record<number, number> = {
  0: 14, // Sunday from 14:00
  1: 14, // Monday from 14:00
  6: 12, // Saturday from 12:00
};

// Hard minimum hour for outbound flights per weekday
const OUTBOUND_MIN_HOUR: Record<number, number> = {
  4: 14, // Thursday from 14:00
  5: 6,  // Friday from 06:00
  6: 6,  // Saturday from 06:00
};

// Hard maximum hour for outbound Saturday (morning departure only)
const OUTBOUND_MAX_HOUR: Record<number, number> = {
  6: 14, // Saturday until 14:00
};

const MIN_NIGHTS = 3;
const MAX_NIGHTS = 7;

function dayOfWeek(dateStr: string): number {
  return new Date(dateStr + 'T12:00:00Z').getUTCDay();
}

function hourOf(dateTimeStr: string): number {
  return parseInt(dateTimeStr.slice(11, 13), 10);
}

function isGoodOutboundHour(fare: DailyFare): boolean {
  const day = dayOfWeek(fare.date);
  const hour = hourOf(fare.departureTime);
  const min = OUTBOUND_MIN_HOUR[day] ?? 0;
  const max = OUTBOUND_MAX_HOUR[day] ?? 24;
  return hour >= min && hour <= max;
}

function isGoodReturnHour(fare: DailyFare): boolean {
  const day = dayOfWeek(fare.date);
  const hour = hourOf(fare.departureTime);
  const min = RETURN_MIN_HOUR[day] ?? 0;
  return hour >= min;
}

/**
 * Score bonus for ranking within valid pairs (lower score = better).
 * Evening/afternoon departures are preferred.
 */
function scoreBonus(outbound: DailyFare, inbound: DailyFare): number {
  const outHour = hourOf(outbound.departureTime);
  const retHour = hourOf(inbound.departureTime);
  const outDay = dayOfWeek(outbound.date);
  const retDay = dayOfWeek(inbound.date);

  let bonus = 0;

  if (outDay === 4 && outHour >= 16) bonus += 20; // Thu evening
  if (outDay === 5 && outHour >= 16) bonus += 15; // Fri evening
  if (outDay === 5 && outHour < 16)  bonus += 8;  // Fri morning/afternoon
  if (outDay === 6 && outHour <= 10) bonus += 10; // Sat early morning

  if ((retDay === 0 || retDay === 1) && retHour >= 18) bonus += 20; // Sun/Mon late evening
  if ((retDay === 0 || retDay === 1) && retHour >= 14) bonus += 10; // Sun/Mon afternoon
  if (retDay === 6 && retHour >= 16) bonus += 10;                   // Sat evening

  return bonus;
}

/**
 * Pairs outbound and inbound fares matching the date+hour pattern:
 * - outbound: Thu≥14:00 / Fri≥06:00 / Sat 06:00–14:00
 * - return: Sun/Mon≥14:00 / Sat≥12:00
 * - 3–7 nights apart
 * Returns top pairs sorted by score (price minus bonus).
 */
export function matchPairs(
  outboundFares: DailyFare[],
  inboundFares: DailyFare[],
  maxTotalPrice: number,
): FarePair[] {
  const pairs: FarePair[] = [];

  // Index valid return fares by date (hard hour filter applied)
  const retByDate = new Map<string, DailyFare>();
  for (const f of inboundFares) {
    const day = dayOfWeek(f.date);
    if (RETURN_DAYS.has(day) && isGoodReturnHour(f)) {
      // Keep only the cheapest qualifying fare per date
      const existing = retByDate.get(f.date);
      if (!existing || f.price < existing.price) {
        retByDate.set(f.date, f);
      }
    }
  }

  for (const out of outboundFares) {
    const outDay = dayOfWeek(out.date);
    if (!OUTBOUND_DAYS.has(outDay)) continue;
    if (!isGoodOutboundHour(out)) continue;

    const outDateMs = new Date(out.date + 'T00:00:00').getTime();

    for (let n = MIN_NIGHTS; n <= MAX_NIGHTS; n++) {
      const retDate = new Date(outDateMs + n * 86_400_000).toISOString().slice(0, 10);
      const ret = retByDate.get(retDate);
      if (!ret) continue;

      const totalPrice = out.price + ret.price;
      if (totalPrice > maxTotalPrice) continue;

      const bonus = scoreBonus(out, ret);
      const score = totalPrice - bonus;

      pairs.push({ outbound: out, inbound: ret, nights: n, totalPrice, score });
    }
  }

  return pairs.sort((a, b) => a.score - b.score);
}
