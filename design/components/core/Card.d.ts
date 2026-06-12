import { ReactNode, MouseEventHandler, CSSProperties } from 'react';

/**
 * Base surface container — white background, border, subtle shadow.
 * All deal cards, info panels, and content sections use this.
 */
export interface CardProps {
  /** Content */
  children?: ReactNode;
  /** Inner padding preset */
  padding?: 'none' | 'sm' | 'md' | 'lg';
  /** Adds hover lift shadow and pointer cursor */
  hoverable?: boolean;
  /** Highlights card with blue left border (active row / selected state) */
  active?: boolean;
  /** Click handler (use with hoverable=true) */
  onClick?: MouseEventHandler<HTMLDivElement>;
  /** Extra inline styles */
  style?: CSSProperties;
}

export declare function Card(props: CardProps): JSX.Element;
