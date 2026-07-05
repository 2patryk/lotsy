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

export interface OneWayMeta {
  plAirports: { iata: string; city: string }[];
  countries: string[];
  cities: { name: string; country: string }[];
  airports: { iata: string; city: string; country: string }[];
  dateMin: string | null;
  dateMax: string | null;
  lastUpdated: string | null;
}
