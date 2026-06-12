import React from 'react';

/**
 * Lotsy Badge — compact status/label pill.
 * Variants map to semantic meaning: green=success, blue=info,
 * amber=warning, red=error, neutral=default.
 */
export function Badge({
  variant = 'neutral',
  dot = false,
  children,
  style: styleProp,
  ...props
}) {
  const variantMap = {
    neutral: {
      backgroundColor: 'var(--color-sidebar-active)',
      color: 'var(--color-text-secondary)',
    },
    blue: {
      backgroundColor: 'var(--color-badge-info-bg)',
      color: 'var(--color-badge-info-fg)',
    },
    green: {
      backgroundColor: 'var(--color-success-bg)',
      color: 'var(--color-success)',
    },
    amber: {
      backgroundColor: 'var(--color-warning-bg)',
      color: 'var(--color-amber-700)',
    },
    red: {
      backgroundColor: 'var(--color-error-bg)',
      color: 'var(--color-error)',
    },
  };

  const v = variantMap[variant] ?? variantMap.neutral;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.3rem',
        padding: '0.1875rem 0.5rem',
        borderRadius: 'var(--radius-full)',
        fontSize: 'var(--text-xs)',
        fontWeight: 'var(--weight-medium)',
        fontFamily: 'var(--font-sans)',
        lineHeight: '1.4',
        whiteSpace: 'nowrap',
        ...v,
        ...styleProp,
      }}
      {...props}
    >
      {dot && (
        <span
          style={{
            width: '5px',
            height: '5px',
            borderRadius: '50%',
            backgroundColor: 'currentColor',
            flexShrink: 0,
          }}
        />
      )}
      {children}
    </span>
  );
}
