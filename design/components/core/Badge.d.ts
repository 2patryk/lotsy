import { ReactNode, CSSProperties } from 'react';

/**
 * Compact status/label pill.
 * Colors are semantically constrained — do not use `green` for anything
 * other than confirmed success states.
 */
export interface BadgeProps {
  /** Semantic color variant */
  variant?: 'neutral' | 'blue' | 'green' | 'amber' | 'red';
  /** Show a small colored dot before the label */
  dot?: boolean;
  /** Badge label content */
  children?: ReactNode;
  /** Extra inline styles */
  style?: CSSProperties;
}

export declare function Badge(props: BadgeProps): JSX.Element;
