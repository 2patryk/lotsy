export interface Deal {
  id: string;
  mixedCarrier: boolean;
  originAirport: string;
  originCountry: string;
  departAt: string;
  destAirport: string;
  destCountry: string;
  returnAt: string;
  nights: number;
  totalPrice: number;
  currency: string;
  pricePerPerson: number;
  outboundSource: string;
  outboundAirline: string;
  outboundPrice: number;
  outboundFlightNo: string | null;
  outboundStops: number;
  outboundBookingUrl: string | null;
  returnSource: string;
  returnAirline: string;
  returnPrice: number;
  returnFlightNo: string | null;
  returnStops: number;
  returnBookingUrl: string | null;
  foundAt: string;
  expiresAt: string;
}
