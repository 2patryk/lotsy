import React, { useState } from 'react';
import { Button } from '../core/Button';
import { Badge } from '../core/Badge';

/**
 * DealCard — row-style deal listing item.
 * Used in the main deals list at /deals.
 * Shows route, destination, price, dates, airline, and optional "good deal" badge.
 */
export function DealCard({
  destination,
  country,
  originCode,
  destinationCode,
  price,
  currency = 'PLN',
  outboundDate,
  returnDate,
  airline,
  isGoodDeal = false,
  savingsPercent,
  selected = false,
  onSelect,
  href,
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        alignItems: 'center',
        gap: '1rem',
        padding: 'var(--space-4) var(--space-5)',
        backgroundColor: hovered ? '#fafafa' : 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)',
        borderLeft: `3px solid ${selected ? 'var(--color-active-border)' : 'transparent'}`,
        cursor: 'pointer',
        transition: 'background-color 0.1s ease, border-left-color 0.15s ease',
        fontFamily: 'var(--font-sans)',
      }}
    >
      {/* ── Left: destination + route ──────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1-5)', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          <span style={{
            fontSize: 'var(--text-base)',
            fontWeight: 'var(--weight-semibold)',
            color: 'var(--color-text-primary)',
          }}>
            {destination}
          </span>
          <span style={{
            fontSize: 'var(--text-sm)',
            color: 'var(--color-text-secondary)',
          }}>
            {country}
          </span>
          {isGoodDeal && (
            <Badge variant="green">
              ✓ Dobra okazja
            </Badge>
          )}
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-4)',
          fontSize: 'var(--text-sm)',
          color: 'var(--color-text-secondary)',
          flexWrap: 'wrap',
        }}>
          <span style={{ fontWeight: 'var(--weight-medium)', color: 'var(--color-text-primary)', letterSpacing: '0.01em' }}>
            {originCode}
            <span style={{ margin: '0 0.25rem', color: 'var(--color-text-tertiary)' }}>→</span>
            {destinationCode}
          </span>
          <span>{outboundDate}–{returnDate}</span>
          <Badge variant="neutral">{airline}</Badge>
        </div>
      </div>

      {/* ── Right: price + CTA ─────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', flexShrink: 0 }}>
        <div style={{ textAlign: 'right' }}>
          <div style={{
            fontSize: 'var(--text-2xs)',
            fontWeight: 'var(--weight-medium)',
            color: 'var(--color-text-tertiary)',
            textTransform: 'uppercase',
            letterSpacing: 'var(--tracking-wider)',
          }}>
            od
          </div>
          <div style={{
            fontSize: 'var(--text-2xl)',
            fontWeight: 'var(--weight-bold)',
            color: 'var(--color-text-primary)',
            lineHeight: 'var(--leading-tight)',
            fontVariantNumeric: 'tabular-nums',
            whiteSpace: 'nowrap',
          }}>
            {price}
            <span style={{
              fontSize: 'var(--text-sm)',
              fontWeight: 'var(--weight-medium)',
              color: 'var(--color-text-secondary)',
              marginLeft: '0.25rem',
            }}>
              {currency}
            </span>
          </div>
          {savingsPercent && (
            <div style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--color-success)',
              fontWeight: 'var(--weight-medium)',
            }}>
              −{savingsPercent}% vs. średnia
            </div>
          )}
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={e => { e.stopPropagation(); if (href) window.open(href, '_blank'); }}
        >
          Sprawdź
        </Button>
      </div>
    </div>
  );
}
