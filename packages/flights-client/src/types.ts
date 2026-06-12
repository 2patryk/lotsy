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
