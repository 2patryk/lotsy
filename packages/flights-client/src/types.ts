// Ryanair oneWayFares/cheapestPerDay response types

export interface RyanairFare {
  day: string; // "2026-07-03"
  departureDate: string; // "2026-07-03T19:45:00"
  arrivalDate: string; // "2026-07-03T21:30:00"
  price: {
    value: number;
    currencyCode: string;
  };
  soldOut: boolean;
  unavailable: boolean;
}

export interface RyanairCheapestPerDayResponse {
  outbound: {
    fares: RyanairFare[];
  };
}

// Ryanair routes/destinations response types

export interface RyanairDestination {
  arrivalAirport: {
    code: string;
    name: string;
    countryCode: string;
    countryName: string;
  };
}

export interface RyanairDestinationsResponse {
  destinations: RyanairDestination[];
}

// Internal normalized types used by the engine

export interface DailyFare {
  date: string; // "2026-07-03"
  departureTime: string; // "2026-07-03T19:45:00"
  arrivalTime: string; // "2026-07-03T21:30:00"
  price: number;
  currency: string;
  airline: string;
  source: string; // "RYANAIR"
  origin: string;
  destination: string;
}

export interface RouteMap {
  // origin IATA -> set of destination IATA codes
  [origin: string]: Set<string>;
}

// Ryanair farfnd/v4/oneWayFares (list) response types — one cheapest fare
// per active route within the requested date window.

export interface RyanairAirportInfo {
  countryName: string; // Polish country name, e.g. "Hiszpania"
  iataCode: string;
  name: string;
  seoName: string;
  city: {
    code: string;
    countryCode: string; // ISO 2-letter code
    name: string; // Polish city name
  };
}

export interface RyanairOneWayFareListItem {
  outbound: {
    departureAirport: RyanairAirportInfo;
    arrivalAirport: RyanairAirportInfo;
    departureDate: string; // local wall-clock, e.g. "2026-07-13T20:25:00"
    arrivalDate: string;
    price: {
      value: number;
      currencyCode: string;
    };
    flightKey: string;
    flightNumber: string;
    previousPrice: { value: number; currencyCode: string } | null;
    priceUpdated: number;
  };
  summary?: unknown;
}

export interface RyanairOneWayFaresListResponse {
  arrivalAirportCategories?: unknown;
  fares: RyanairOneWayFareListItem[];
  nextPage: string | null;
  size: number;
}

// Params for getOneWayFaresList — either an outbound origin airport, or an
// inbound pair (arrival country + departure country). One of the two must be set.
export interface OneWayFaresListParams {
  outboundDepartureDateFrom: string; // "YYYY-MM-DD"
  outboundDepartureDateTo: string; // "YYYY-MM-DD"
  currency?: string;
  market?: string;
  limit?: number;
  offset?: number;
  // Variant A: outbound from a specific Polish airport
  departureAirportIataCode?: string;
  // Variant B: inbound to Poland from a foreign country
  arrivalCountryCode?: string;
  departureCountryCode?: string;
}

// Normalized single-fare row used by the engine.
export interface OneWayFareListItem {
  origin: string;
  originCity: string;
  originCountry: string; // Polish name
  destination: string;
  destCity: string;
  destCountry: string; // Polish name
  destCountryCode: string; // ISO 2-letter code
  date: string; // "YYYY-MM-DD" (derived from departureDate)
  departureTime: string; // local wall-clock, e.g. "2026-07-13T20:25:00"
  arrivalTime: string;
  price: number;
  currency: string;
  flightNumber: string;
}
