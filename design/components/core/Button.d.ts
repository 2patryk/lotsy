import { ReactNode, MouseEventHandler, CSSProperties } from 'react';

/**
 * Primary interactive control for Lotsy UI.
 * Use sparingly — one primary button per section maximum.
 *
 */
export interface ButtonProps {
  /** Visual style variant */
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  /** Size of the button */
  size?: 'sm' | 'md' | 'lg';
  /** Button content */
  children?: ReactNode;
  /** Disabled state — prevents interaction and reduces opacity */
  disabled?: boolean;
  /** Click handler */
  onClick?: MouseEventHandler<HTMLButtonElement>;
  /** Leading icon element (e.g. an SVG or icon component) */
  icon?: ReactNode;
  /** Trailing icon element */
  trailingIcon?: ReactNode;
  /** Stretch button to container width */
  fullWidth?: boolean;
  /** HTML button type attribute */
  type?: 'button' | 'submit' | 'reset';
  /** Extra inline styles */
  style?: CSSProperties;
}

export declare function Button(props: ButtonProps): JSX.Element;
