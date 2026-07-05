export type OneWayDirection = 'OUT' | 'IN';

export interface OneWayFare {
  id: string;
  direction: OneWayDirection;
  origin: string;
  originCity: string;
  originCountry: string;
  destination: string;
  destCity: string;
  destCountry: string;
  date: string; // ISO date
  departureTime: string; // ISO datetime
  arrivalTime: string; // ISO datetime
  flightNumber: string | null;
  price: number;
  currency: string;
  source: string; // "RYANAIR" | "WIZZAIR"
  airline: string; // display name, e.g. "Ryanair" / "Wizz Air"
  updatedAt: string;
}

// Row from GET /oneway/onward — a live carrier lookup around one airport.
// mode=departures: flights leaving the airport; mode=arrivals: flights into it.
export interface OnwardFlight {
  origin: string;
  destination: string;
  originCity: string;
  originCountry: string;
  destCity: string;
  destCountry: string;
  date: string; // YYYY-MM-DD
  departureTime: string; // ISO datetime
  arrivalTime: string;
  price: number; // PLN
  currency: 'PLN';
  source: 'RYANAIR' | 'WIZZAIR' | 'GOOGLE';
  airline: string;
  flightNumber: string | null;
}

export type OnwardMode = 'departures' | 'arrivals';
export type OnwardCarrier = 'ryanair' | 'wizz' | 'google';

export interface OneWayMeta {
  plAirports: { iata: string; city: string }[];
  countries: string[];
  cities: { name: string; country: string }[];
  airports: { iata: string; city: string; country: string }[];
  dateMin: string | null;
  dateMax: string | null;
  lastUpdated: string | null;
}
