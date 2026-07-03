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
  price: number;
  pakietId: string | null;
  updatedAt: string;
}

export interface ChartersMeta {
  origins: { iata: string; name: string }[];
  countries: string[];
  minDate: string | null;
  maxDate: string | null;
  lastUpdate: string | null;
}
