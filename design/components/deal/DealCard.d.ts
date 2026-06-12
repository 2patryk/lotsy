/**
 * Main deal listing row. Shows route, destination, price, dates, airline,
 * and an optional "Dobra okazja" badge.
 *
 */
export interface DealCardProps {
  /** City name, e.g. "Barcelona" */
  destination: string;
  /** Country name in Polish, e.g. "Hiszpania" */
  country: string;
  /** IATA origin code, e.g. "WAW" */
  originCode: string;
  /** IATA destination code, e.g. "BCN" */
  destinationCode: string;
  /** Numeric price */
  price: number;
  /** Currency code, defaults to "PLN" */
  currency?: string;
  /** Formatted outbound date, e.g. "15 sie" */
  outboundDate: string;
  /** Formatted return date, e.g. "17 sie" */
  returnDate: string;
  /** Airline name, e.g. "Ryanair" */
  airline: string;
  /** Show green "Dobra okazja" badge */
  isGoodDeal?: boolean;
  /** Percentage savings vs. average price */
  savingsPercent?: number;
  /** Whether this row is currently selected (shows blue left border) */
  selected?: boolean;
  /** Row click handler */
  onSelect?: () => void;
  /** URL to open on "Sprawdź" button click */
  href?: string;
}

export declare function DealCard(props: DealCardProps): JSX.Element;
