import React, { useState } from 'react';

/**
 * Lotsy Button — primary interactive control.
 * Use `primary` for the main CTA, `secondary` for secondary actions,
 * `ghost` for low-emphasis or toolbar actions.
 */
export function Button({
  variant = 'primary',
  size = 'md',
  children,
  disabled = false,
  onClick,
  icon,
  trailingIcon,
  fullWidth = false,
  type = 'button',
  style: styleProp,
  ...props
}) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  const base = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.375rem',
    fontFamily: 'var(--font-sans)',
    fontWeight: 'var(--weight-medium)',
    lineHeight: 'var(--leading-none)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    outline: 'none',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    width: fullWidth ? '100%' : 'auto',
    opacity: disabled ? 0.5 : 1,
    transform: pressed && !disabled ? 'scale(0.97)' : 'scale(1)',
    transition: 'background-color 0.12s ease, color 0.12s ease, transform 0.08s ease',
    textDecoration: 'none',
    whiteSpace: 'nowrap',
  };

  const sizes = {
    sm: { padding: '0.3125rem 0.625rem', fontSize: 'var(--text-xs)' },
    md: { padding: '0.4375rem 0.875rem', fontSize: 'var(--text-sm)' },
    lg: { padding: '0.625rem 1.125rem', fontSize: 'var(--text-base)' },
  };

  const variants = {
    primary: {
      backgroundColor: hovered && !disabled ? 'var(--color-blue-800)' : 'var(--color-blue-700)',
      color: '#fff',
    },
    secondary: {
      backgroundColor: hovered && !disabled ? 'var(--color-sidebar-active)' : 'var(--color-surface)',
      color: 'var(--color-text-primary)',
      border: '1px solid var(--color-border)',
    },
    ghost: {
      backgroundColor: hovered && !disabled ? 'var(--color-sidebar-active)' : 'transparent',
      color: 'var(--color-text-secondary)',
    },
    danger: {
      backgroundColor: hovered && !disabled ? 'var(--color-red-700)' : 'var(--color-red-600)',
      color: '#fff',
    },
  };

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      style={{ ...base, ...sizes[size], ...variants[variant], ...styleProp }}
      {...props}
    >
      {icon && <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>{icon}</span>}
      {children}
      {trailingIcon && <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>{trailingIcon}</span>}
    </button>
  );
}
