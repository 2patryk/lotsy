import { fetchJson } from './http.js';
import type {
  RyanairCheapestPerDayResponse,
  RyanairDestinationsResponse,
  DailyFare,
} from './types.js';

const BASE = 'https://www.ryanair.com/api';

function monthParam(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-01`;
}

/**
 * Returns the cheapest one-way fare per day for a given route and month.
 * Filters out soldOut and unavailable fares.
 */
export async function getCheapestPerDay(
  origin: string,
  destination: string,
  year: number,
  month: number,
  currency = 'PLN',
): Promise<DailyFare[]> {
  const url =
    `${BASE}/farfnd/v4/oneWayFares/${origin}/${destination}/cheapestPerDay` +
    `?outboundMonthOfDate=${monthParam(year, month)}&currency=${currency}`;

  const data = await fetchJson<RyanairCheapestPerDayResponse>(url);

  return data.outbound.fares
    .filter((f) => !f.soldOut && !f.unavailable && f.price.value > 0)
    .map((f) => ({
      date: f.day,
      departureTime: f.departureDate + 'Z',
      arrivalTime: f.arrivalDate + 'Z',
      price: f.price.value,
      currency: f.price.currencyCode,
      airline: 'Ryanair',
      source: 'RYANAIR',
      origin,
      destination,
    }));
}

/**
 * Returns IATA codes of destinations served from the given origin airport.
 * Should be cached — call once per day.
 */
export async function getDestinations(origin: string): Promise<string[]> {
  const url =
    `${BASE}/views/locate/searchWidget/routes/en/airport/${origin}`;

  const data = await fetchJson<RyanairDestinationsResponse | RyanairDestinationsResponse['destinations']>(url);

  const destinations = Array.isArray(data) ? data : (data as RyanairDestinationsResponse).destinations;

  return destinations
    .map((d) => {
      if ('arrivalAirport' in d) return d.arrivalAirport.code;
      const any = d as Record<string, unknown>;
      return (any['iataCode'] as string) ?? (any['code'] as string) ?? '';
    })
    .filter(Boolean);
}
