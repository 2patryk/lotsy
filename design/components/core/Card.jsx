import React, { useState } from 'react';

/**
 * Lotsy Card — base surface container.
 * White background, 1px border, subtle shadow.
 * Use `hoverable` for clickable cards; `active` adds the blue left border.
 */
export function Card({
  children,
  padding = 'md',
  hoverable = false,
  active = false,
  onClick,
  style: styleProp,
  ...props
}) {
  const [hovered, setHovered] = useState(false);

  const paddings = {
    none: '0',
    sm:   'var(--space-3)',
    md:   'var(--space-4)',
    lg:   'var(--space-6)',
  };

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => hoverable && setHovered(true)}
      onMouseLeave={() => hoverable && setHovered(false)}
      style={{
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: hovered && hoverable ? 'var(--shadow-md)' : 'var(--shadow-sm)',
        padding: paddings[padding],
        borderLeft: active ? '3px solid var(--color-active-border)' : '1px solid var(--color-border)',
        cursor: hoverable ? 'pointer' : undefined,
        transition: 'box-shadow 0.15s ease, background-color 0.1s ease',
        backgroundColor: hovered && hoverable ? 'var(--color-surface-hover)' : 'var(--color-surface)',
        ...styleProp,
      }}
      {...props}
    >
      {children}
    </div>
  );
}
