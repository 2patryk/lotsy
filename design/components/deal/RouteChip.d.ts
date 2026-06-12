import { CSSProperties } from 'react';

/**
 * Compact IATA route display: "WAW → BCN".
 * Use inline in deal rows, detail panels, and search results.
 */
export interface RouteChipProps {
  /** IATA origin airport code, e.g. "WAW" */
  origin: string;
  /** IATA destination airport code, e.g. "BCN" */
  destination: string;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Extra inline styles */
  style?: CSSProperties;
}

export declare function RouteChip(props: RouteChipProps): JSX.Element;
