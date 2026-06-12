import React, { useState } from 'react';

/**
 * Lotsy Input — text field with optional label, icon, hint, and error.
 */
export function Input({
  label,
  placeholder,
  type = 'text',
  value,
  onChange,
  icon,
  error,
  hint,
  disabled = false,
  id,
  style: styleProp,
  ...props
}) {
  const [focused, setFocused] = useState(false);

  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1-5)', fontFamily: 'var(--font-sans)' }}>
      {label && (
        <label
          htmlFor={inputId}
          style={{
            fontSize: 'var(--text-xs)',
            fontWeight: 'var(--weight-medium)',
            color: 'var(--color-text-secondary)',
            letterSpacing: 'var(--tracking-wide)',
            textTransform: 'uppercase',
          }}
        >
          {label}
        </label>
      )}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        {icon && (
          <span
            style={{
              position: 'absolute',
              left: '0.625rem',
              top: '50%',
              transform: 'translateY(-50%)',
              color: focused ? 'var(--color-blue-700)' : 'var(--color-text-tertiary)',
              display: 'flex',
              alignItems: 'center',
              pointerEvents: 'none',
              transition: 'color 0.15s ease',
            }}
          >
            {icon}
          </span>
        )}
        <input
          id={inputId}
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          disabled={disabled}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            display: 'block',
            width: '100%',
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--text-sm)',
            color: 'var(--color-text-primary)',
            backgroundColor: disabled ? 'var(--color-sidebar-active)' : 'var(--color-surface)',
            border: `1px solid ${error ? 'var(--color-error)' : focused ? 'var(--color-blue-700)' : 'var(--color-border)'}`,
            borderRadius: 'var(--radius-md)',
            padding: icon ? '0.4375rem 0.75rem 0.4375rem 2.25rem' : '0.4375rem 0.75rem',
            outline: 'none',
            boxShadow: error ? 'none' : focused ? 'var(--shadow-focus)' : 'none',
            transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
            cursor: disabled ? 'not-allowed' : 'text',
            opacity: disabled ? 0.65 : 1,
            boxSizing: 'border-box',
            ...styleProp,
          }}
          {...props}
        />
      </div>
      {hint && !error && (
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
          {hint}
        </span>
      )}
      {error && (
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-error)' }}>
          {error}
        </span>
      )}
    </div>
  );
}
