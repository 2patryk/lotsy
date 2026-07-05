// Currency conversion to PLN. Wizz returns fares in the departure country's
// currency (EUR, GBP, HUF, RON, …), so every fare must be normalized to PLN
// before we can compare carriers (mix & match) or display a price.

// currency code -> how many PLN one unit is worth
let cache: Record<string, number> | null = null;

// ECB reference rates via Frankfurter (free, no API key). base=PLN gives
// { EUR: 0.23, GBP: 0.20, … } = units per 1 PLN; we invert to PLN per unit.
const FX_URL = 'https://api.frankfurter.dev/v1/latest?base=PLN';

export async function getPlnRates(): Promise<Record<string, number>> {
  if (cache) return cache;

  const rates: Record<string, number> = { PLN: 1 };
  try {
    const res = await fetch(FX_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { rates: Record<string, number> };
    for (const [currency, perPln] of Object.entries(data.rates)) {
      if (perPln > 0) rates[currency] = 1 / perPln;
    }
    console.log(`[fx] loaded ${Object.keys(rates).length} PLN rates`);
  } catch (err) {
    console.warn('[fx] rate fetch failed — non-PLN fares will be dropped:', err);
  }

  cache = rates;
  return rates;
}

/**
 * Converts a price to PLN. Returns null when the currency is unknown (no rate)
 * — the caller should drop the fare rather than compare mismatched currencies.
 */
export function toPln(
  price: number,
  currency: string,
  rates: Record<string, number>,
): number | null {
  if (currency === 'PLN') return price;
  const mult = rates[currency];
  if (!mult) return null;
  return Math.round(price * mult * 100) / 100;
}
