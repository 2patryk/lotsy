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

// Hard minimum hour for outbound flights per weekday
const OUTBOUND_MIN_HOUR: Record<number, number> = {
  4: 14, // Thursday from 14:00
  5: 6, // Friday from 06:00
  6: 6, // Saturday from 06:00
};

const OUTBOUND_MAX_HOUR: Record<number, number> = {
  6: 14, // Saturday until 14:00
};

//
// Return rules are outbound-day-dependent:
//
// Thu (4) / Fri (5) outbound → return on Sun (0), Mon (1), Tue (2)
//   Sat return is excluded: Thu+2=Sat=2n (too few), Thu+9=Sat=9n (too many)
//   Tue adds a 5-night (Thu) or 4-night (Fri) option that was missing.
//
// Sat (6) outbound → return on Sat (6) only (7 nights)
//   Sun/Mon after Sat = 1–2n (too few); next Sun/Mon = 8–9n (too many)
//

// Min departure hour for return flights
const RETURN_MIN_HOUR_THU_FRI: Record<number, number> = {
  0: 14, // Sunday from 14:00
  1: 14, // Monday from 14:00
  2: 14, // Tuesday from 14:00
};

const RETURN_MIN_HOUR_SAT: Record<number, number> = {
  6: 12, // Saturday from 12:00
};

const MIN_NIGHTS = 2;
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

function scoreBonus(outbound: DailyFare, inbound: DailyFare): number {
  const outHour = hourOf(outbound.departureTime);
  const retHour = hourOf(inbound.departureTime);
  const outDay = dayOfWeek(outbound.date);
  const retDay = dayOfWeek(inbound.date);

  let bonus = 0;

  if (outDay === 4 && outHour >= 16) bonus += 20; // Thu evening
  if (outDay === 5 && outHour >= 16) bonus += 15; // Fri evening
  if (outDay === 5 && outHour < 16) bonus += 8; // Fri morning/afternoon
  if (outDay === 6 && outHour <= 10) bonus += 10; // Sat early morning

  if ((retDay === 0 || retDay === 1) && retHour >= 18) bonus += 20; // Sun/Mon late evening
  if ((retDay === 0 || retDay === 1) && retHour >= 14) bonus += 10; // Sun/Mon afternoon
  if (retDay === 2 && retHour >= 18) bonus += 8; // Tue evening
  if (retDay === 2 && retHour >= 14) bonus += 4; // Tue afternoon
  if (retDay === 6 && retHour >= 16) bonus += 10; // Sat evening

  return bonus;
}

export function matchPairs(
  outboundFares: DailyFare[],
  inboundFares: DailyFare[],
  maxTotalPrice: number,
): FarePair[] {
  // Build two return-fare indexes depending on which outbound day will use them:
  // Thu/Fri outbound → Sun, Mon, Tue returns
  const retForThuFri = new Map<string, DailyFare>();
  // Sat outbound → Sat returns only
  const retForSat = new Map<string, DailyFare>();

  for (const f of inboundFares) {
    const day = dayOfWeek(f.date);
    const hour = hourOf(f.departureTime);

    const minThuFri = RETURN_MIN_HOUR_THU_FRI[day];
    if (minThuFri !== undefined && hour >= minThuFri) {
      const existing = retForThuFri.get(f.date);
      if (!existing || f.price < existing.price) retForThuFri.set(f.date, f);
    }

    const minSat = RETURN_MIN_HOUR_SAT[day];
    if (minSat !== undefined && hour >= minSat) {
      const existing = retForSat.get(f.date);
      if (!existing || f.price < existing.price) retForSat.set(f.date, f);
    }
  }

  const pairs: FarePair[] = [];

  for (const out of outboundFares) {
    const outDay = dayOfWeek(out.date);
    if (!OUTBOUND_DAYS.has(outDay)) continue;
    if (!isGoodOutboundHour(out)) continue;

    const retMap = outDay === 6 ? retForSat : retForThuFri;
    const outDateMs = new Date(out.date + 'T12:00:00Z').getTime();

    for (let n = MIN_NIGHTS; n <= MAX_NIGHTS; n++) {
      const retDate = new Date(outDateMs + n * 86_400_000).toISOString().slice(0, 10);
      const ret = retMap.get(retDate);
      if (!ret) continue;

      const totalPrice = out.price + ret.price;
      if (totalPrice > maxTotalPrice) continue;

      const bonus = scoreBonus(out, ret);
      pairs.push({ outbound: out, inbound: ret, nights: n, totalPrice, score: totalPrice - bonus });
    }
  }

  return pairs.sort((a, b) => a.score - b.score);
}
