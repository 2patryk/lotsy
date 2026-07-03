export interface CharterFlight {
  id: string;
  oneWay: boolean;
  destIata: string;
  destName: string;
  destNameUrl: string;
  destCountry: string;
  destCountryUrl: string;
  imageUrl: string | null;
  date: string; // ISO, departure date
  depTime: string; // HH:MM
  arrTime: string;
  depIata: string;
  depAirport: string;
  airline: string;
  flightNo: string | null;
  flightTime: string | null;
  baggageKg: number | null;
  price: number; // per person; round-trip → outbound part of the package
  pakietId: string | null;
  // Return leg (round-trip only)
  returnDate: string | null;
  retDepTime: string | null;
  retArrTime: string | null;
  retArrIata: string | null;
  retArrAirport: string | null;
  retAirline: string | null;
  retFlightNo: string | null;
  returnPrice: number | null;
  retPakietId: string | null;
  nights: number | null;
  totalPrice: number | null; // one-way → price; round-trip → price + returnPrice
  updatedAt: string;
}

export interface ChartersMeta {
  origins: { iata: string; name: string }[];
  countries: string[];
  minDate: string | null;
  maxDate: string | null;
  minPrice: number | null;
  maxPrice: number | null;
  lastUpdate: string | null;
}
