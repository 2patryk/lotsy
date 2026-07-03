export interface CharterOffer {
  destIata: string;
  destName: string;
  destNameUrl: string;
  destCountry: string;
  destCountryUrl: string;
  priceRoundTrip: number | null;
  priceOneWay: number | null;
  nearestDeparture: string | null;
  baggageKg: number | null;
  imageUrl: string | null;
  updatedAt: string;
}

export interface ChartersResponse {
  offers: CharterOffer[];
  lastUpdate: string | null;
}
