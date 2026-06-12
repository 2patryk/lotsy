import { ChangeEventHandler, ReactNode, CSSProperties } from 'react';

/**
 * Text input with label, optional leading icon, hint text, and error state.
 * Used in filter bars, search boxes, alert creation forms.
 */
export interface InputProps {
  /** Visible label above the field */
  label?: string;
  /** Placeholder text */
  placeholder?: string;
  /** HTML input type */
  type?: 'text' | 'email' | 'password' | 'number' | 'search' | 'tel' | 'url';
  /** Controlled value */
  value?: string;
  /** Change handler */
  onChange?: ChangeEventHandler<HTMLInputElement>;
  /** Leading icon element */
  icon?: ReactNode;
  /** Error message — renders below field and changes border to red */
  error?: string;
  /** Helper text — rendered below field when no error */
  hint?: string;
  /** Disabled state */
  disabled?: boolean;
  /** HTML id (auto-derived from label if omitted) */
  id?: string;
  /** Extra inline styles applied to the `<input>` element */
  style?: CSSProperties;
}

export declare function Input(props: InputProps): JSX.Element;
