import React from 'react';

/**
 * RouteChip — inline display of a flight route with IATA codes.
 * e.g. "WAW → BCN"
 */
export function RouteChip({
  origin,
  destination,
  size = 'md',
  style: styleProp,
  ...props
}) {
  const sizes = {
    sm: { fontSize: 'var(--text-xs)', padding: '0.125rem 0.375rem' },
    md: { fontSize: 'var(--text-sm)', padding: '0.25rem 0.5rem' },
    lg: { fontSize: 'var(--text-base)', padding: '0.375rem 0.625rem' },
  };

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.25rem',
        fontFamily: 'var(--font-sans)',
        fontWeight: 'var(--weight-semibold)',
        letterSpacing: '0.03em',
        color: 'var(--color-text-primary)',
        backgroundColor: 'var(--color-sidebar-active)',
        borderRadius: 'var(--radius-sm)',
        ...sizes[size],
        ...styleProp,
      }}
      {...props}
    >
      <span>{origin}</span>
      <span style={{ color: 'var(--color-text-tertiary)', fontWeight: 'var(--weight-regular)', margin: '0 0.1em' }}>
        →
      </span>
      <span>{destination}</span>
    </span>
  );
}
