import { fetchJson } from './http.ts';
import type {
  RyanairCheapestPerDayResponse,
  RyanairDestinationsResponse,
  RyanairOneWayFaresListResponse,
  OneWayFaresListParams,
  OneWayFareListItem,
  DailyFare,
} from './types.ts';

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
  const url = `${BASE}/views/locate/searchWidget/routes/en/airport/${origin}`;

  const data = await fetchJson<
    RyanairDestinationsResponse | RyanairDestinationsResponse['destinations']
  >(url);

  const destinations = Array.isArray(data)
    ? data
    : (data as RyanairDestinationsResponse).destinations;

  return destinations
    .map((d) => {
      if ('arrivalAirport' in d) return d.arrivalAirport.code;
      const any = d as Record<string, unknown>;
      return (any['iataCode'] as string) ?? (any['code'] as string) ?? '';
    })
    .filter(Boolean);
}

/**
 * Returns the cheapest one-way fare per active route within a date window
 * (one row per route, not per day — used for discovery of active routes).
 *
 * Two mutually-exclusive filter variants, matching Ryanair's API:
 *  - outbound from Poland: pass `departureAirportIataCode`.
 *  - inbound to Poland: pass `arrivalCountryCode: 'pl'` + `departureCountryCode`.
 */
export async function getOneWayFaresList(
  params: OneWayFaresListParams,
): Promise<OneWayFareListItem[]> {
  const {
    outboundDepartureDateFrom,
    outboundDepartureDateTo,
    currency = 'PLN',
    market = 'pl-pl',
    limit = 300,
    offset = 0,
    departureAirportIataCode,
    arrivalCountryCode,
    departureCountryCode,
  } = params;

  const hasOutboundVariant = Boolean(departureAirportIataCode);
  const hasInboundVariant = Boolean(arrivalCountryCode && departureCountryCode);
  if (!hasOutboundVariant && !hasInboundVariant) {
    throw new Error(
      'getOneWayFaresList: must provide either departureAirportIataCode, ' +
        'or both arrivalCountryCode and departureCountryCode',
    );
  }

  const qs = new URLSearchParams({
    outboundDepartureDateFrom,
    outboundDepartureDateTo,
    market,
    currency,
    limit: String(limit),
    offset: String(offset),
  });
  if (departureAirportIataCode) qs.set('departureAirportIataCode', departureAirportIataCode);
  if (arrivalCountryCode) qs.set('arrivalCountryCode', arrivalCountryCode);
  if (departureCountryCode) qs.set('departureCountryCode', departureCountryCode);

  const url = `${BASE}/farfnd/v4/oneWayFares?${qs}`;
  const data = await fetchJson<RyanairOneWayFaresListResponse>(url);

  return (data.fares ?? []).map((f) => {
    const { departureAirport, arrivalAirport, departureDate, arrivalDate, price, flightNumber } =
      f.outbound;
    return {
      origin: departureAirport.iataCode,
      originCity: departureAirport.city.name,
      originCountry: departureAirport.countryName,
      destination: arrivalAirport.iataCode,
      destCity: arrivalAirport.city.name,
      destCountry: arrivalAirport.countryName,
      destCountryCode: arrivalAirport.city.countryCode,
      date: departureDate.slice(0, 10),
      departureTime: departureDate,
      arrivalTime: arrivalDate,
      price: price.value,
      currency: price.currencyCode,
      flightNumber,
    };
  });
}
