/* @ds-bundle: {"format":3,"namespace":"LotsyDesignSystem_028532","components":[{"name":"Badge","sourcePath":"components/core/Badge.jsx"},{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Card","sourcePath":"components/core/Card.jsx"},{"name":"Input","sourcePath":"components/core/Input.jsx"},{"name":"DealCard","sourcePath":"components/deal/DealCard.jsx"},{"name":"RouteChip","sourcePath":"components/deal/RouteChip.jsx"}],"sourceHashes":{"components/core/Badge.jsx":"eba1fd546da8","components/core/Button.jsx":"a6355c2f38e3","components/core/Card.jsx":"c3efacbdee83","components/core/Input.jsx":"de1aef39b71f","components/deal/DealCard.jsx":"8b849ef281eb","components/deal/RouteChip.jsx":"9982d76f9cc1"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.LotsyDesignSystem_028532 = window.LotsyDesignSystem_028532 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/core/Badge.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Lotsy Badge — compact status/label pill.
 * Variants map to semantic meaning: green=success, blue=info,
 * amber=warning, red=error, neutral=default.
 */
function Badge({
  variant = 'neutral',
  dot = false,
  children,
  style: styleProp,
  ...props
}) {
  const variantMap = {
    neutral: {
      backgroundColor: 'var(--color-sidebar-active)',
      color: 'var(--color-text-secondary)'
    },
    blue: {
      backgroundColor: 'var(--color-badge-info-bg)',
      color: 'var(--color-badge-info-fg)'
    },
    green: {
      backgroundColor: 'var(--color-success-bg)',
      color: 'var(--color-success)'
    },
    amber: {
      backgroundColor: 'var(--color-warning-bg)',
      color: 'var(--color-amber-700)'
    },
    red: {
      backgroundColor: 'var(--color-error-bg)',
      color: 'var(--color-error)'
    }
  };
  const v = variantMap[variant] ?? variantMap.neutral;
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
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
      ...styleProp
    }
  }, props), dot && /*#__PURE__*/React.createElement("span", {
    style: {
      width: '5px',
      height: '5px',
      borderRadius: '50%',
      backgroundColor: 'currentColor',
      flexShrink: 0
    }
  }), children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Badge.jsx", error: String((e && e.message) || e) }); }

// components/core/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const {
  useState
} = React;
/**
 * Lotsy Button — primary interactive control.
 * Use `primary` for the main CTA, `secondary` for secondary actions,
 * `ghost` for low-emphasis or toolbar actions.
 */
function Button({
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
    whiteSpace: 'nowrap'
  };
  const sizes = {
    sm: {
      padding: '0.3125rem 0.625rem',
      fontSize: 'var(--text-xs)'
    },
    md: {
      padding: '0.4375rem 0.875rem',
      fontSize: 'var(--text-sm)'
    },
    lg: {
      padding: '0.625rem 1.125rem',
      fontSize: 'var(--text-base)'
    }
  };
  const variants = {
    primary: {
      backgroundColor: hovered && !disabled ? 'var(--color-blue-800)' : 'var(--color-blue-700)',
      color: '#fff'
    },
    secondary: {
      backgroundColor: hovered && !disabled ? 'var(--color-sidebar-active)' : 'var(--color-surface)',
      color: 'var(--color-text-primary)',
      border: '1px solid var(--color-border)'
    },
    ghost: {
      backgroundColor: hovered && !disabled ? 'var(--color-sidebar-active)' : 'transparent',
      color: 'var(--color-text-secondary)'
    },
    danger: {
      backgroundColor: hovered && !disabled ? 'var(--color-red-700)' : 'var(--color-red-600)',
      color: '#fff'
    }
  };
  return /*#__PURE__*/React.createElement("button", _extends({
    type: type,
    disabled: disabled,
    onClick: disabled ? undefined : onClick,
    onMouseEnter: () => setHovered(true),
    onMouseLeave: () => {
      setHovered(false);
      setPressed(false);
    },
    onMouseDown: () => setPressed(true),
    onMouseUp: () => setPressed(false),
    style: {
      ...base,
      ...sizes[size],
      ...variants[variant],
      ...styleProp
    }
  }, props), icon && /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      alignItems: 'center',
      flexShrink: 0
    }
  }, icon), children, trailingIcon && /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      alignItems: 'center',
      flexShrink: 0
    }
  }, trailingIcon));
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/Card.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const {
  useState
} = React;
/**
 * Lotsy Card — base surface container.
 * White background, 1px border, subtle shadow.
 * Use `hoverable` for clickable cards; `active` adds the blue left border.
 */
function Card({
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
    sm: 'var(--space-3)',
    md: 'var(--space-4)',
    lg: 'var(--space-6)'
  };
  return /*#__PURE__*/React.createElement("div", _extends({
    onClick: onClick,
    onMouseEnter: () => hoverable && setHovered(true),
    onMouseLeave: () => hoverable && setHovered(false),
    style: {
      backgroundColor: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-lg)',
      boxShadow: hovered && hoverable ? 'var(--shadow-md)' : 'var(--shadow-sm)',
      padding: paddings[padding],
      borderLeft: active ? '3px solid var(--color-active-border)' : '1px solid var(--color-border)',
      cursor: hoverable ? 'pointer' : undefined,
      transition: 'box-shadow 0.15s ease, background-color 0.1s ease',
      backgroundColor: hovered && hoverable ? 'var(--color-surface-hover)' : 'var(--color-surface)',
      ...styleProp
    }
  }, props), children);
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Card.jsx", error: String((e && e.message) || e) }); }

// components/core/Input.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const {
  useState
} = React;
/**
 * Lotsy Input — text field with optional label, icon, hint, and error.
 */
function Input({
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
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-1-5)',
      fontFamily: 'var(--font-sans)'
    }
  }, label && /*#__PURE__*/React.createElement("label", {
    htmlFor: inputId,
    style: {
      fontSize: 'var(--text-xs)',
      fontWeight: 'var(--weight-medium)',
      color: 'var(--color-text-secondary)',
      letterSpacing: 'var(--tracking-wide)',
      textTransform: 'uppercase'
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      display: 'flex',
      alignItems: 'center'
    }
  }, icon && /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      left: '0.625rem',
      top: '50%',
      transform: 'translateY(-50%)',
      color: focused ? 'var(--color-blue-700)' : 'var(--color-text-tertiary)',
      display: 'flex',
      alignItems: 'center',
      pointerEvents: 'none',
      transition: 'color 0.15s ease'
    }
  }, icon), /*#__PURE__*/React.createElement("input", _extends({
    id: inputId,
    type: type,
    placeholder: placeholder,
    value: value,
    onChange: onChange,
    disabled: disabled,
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false),
    style: {
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
      ...styleProp
    }
  }, props))), hint && !error && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-xs)',
      color: 'var(--color-text-tertiary)'
    }
  }, hint), error && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-xs)',
      color: 'var(--color-error)'
    }
  }, error));
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Input.jsx", error: String((e && e.message) || e) }); }

// components/deal/DealCard.jsx
try { (() => {
const {
  useState
} = React;
/**
 * DealCard — row-style deal listing item.
 * Used in the main deals list at /deals.
 * Shows route, destination, price, dates, airline, and optional "good deal" badge.
 */
function DealCard({
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
  href
}) {
  const [hovered, setHovered] = useState(false);
  return /*#__PURE__*/React.createElement("div", {
    onClick: onSelect,
    onMouseEnter: () => setHovered(true),
    onMouseLeave: () => setHovered(false),
    style: {
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
      fontFamily: 'var(--font-sans)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-1-5)',
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-2)',
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-base)',
      fontWeight: 'var(--weight-semibold)',
      color: 'var(--color-text-primary)'
    }
  }, destination), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-sm)',
      color: 'var(--color-text-secondary)'
    }
  }, country), isGoodDeal && /*#__PURE__*/React.createElement(__ds_scope.Badge, {
    variant: "green"
  }, "\u2713 Dobra okazja")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-4)',
      fontSize: 'var(--text-sm)',
      color: 'var(--color-text-secondary)',
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 'var(--weight-medium)',
      color: 'var(--color-text-primary)',
      letterSpacing: '0.01em'
    }
  }, originCode, /*#__PURE__*/React.createElement("span", {
    style: {
      margin: '0 0.25rem',
      color: 'var(--color-text-tertiary)'
    }
  }, "\u2192"), destinationCode), /*#__PURE__*/React.createElement("span", null, outboundDate, "\u2013", returnDate), /*#__PURE__*/React.createElement(__ds_scope.Badge, {
    variant: "neutral"
  }, airline))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-4)',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'right'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-2xs)',
      fontWeight: 'var(--weight-medium)',
      color: 'var(--color-text-tertiary)',
      textTransform: 'uppercase',
      letterSpacing: 'var(--tracking-wider)'
    }
  }, "od"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-2xl)',
      fontWeight: 'var(--weight-bold)',
      color: 'var(--color-text-primary)',
      lineHeight: 'var(--leading-tight)',
      fontVariantNumeric: 'tabular-nums',
      whiteSpace: 'nowrap'
    }
  }, price, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-sm)',
      fontWeight: 'var(--weight-medium)',
      color: 'var(--color-text-secondary)',
      marginLeft: '0.25rem'
    }
  }, currency)), savingsPercent && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-xs)',
      color: 'var(--color-success)',
      fontWeight: 'var(--weight-medium)'
    }
  }, "\u2212", savingsPercent, "% vs. \u015Brednia")), /*#__PURE__*/React.createElement(__ds_scope.Button, {
    variant: "primary",
    size: "sm",
    onClick: e => {
      e.stopPropagation();
      if (href) window.open(href, '_blank');
    }
  }, "Sprawd\u017A")));
}
Object.assign(__ds_scope, { DealCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/deal/DealCard.jsx", error: String((e && e.message) || e) }); }

// components/deal/RouteChip.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * RouteChip — inline display of a flight route with IATA codes.
 * e.g. "WAW → BCN"
 */
function RouteChip({
  origin,
  destination,
  size = 'md',
  style: styleProp,
  ...props
}) {
  const sizes = {
    sm: {
      fontSize: 'var(--text-xs)',
      padding: '0.125rem 0.375rem'
    },
    md: {
      fontSize: 'var(--text-sm)',
      padding: '0.25rem 0.5rem'
    },
    lg: {
      fontSize: 'var(--text-base)',
      padding: '0.375rem 0.625rem'
    }
  };
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
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
      ...styleProp
    }
  }, props), /*#__PURE__*/React.createElement("span", null, origin), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--color-text-tertiary)',
      fontWeight: 'var(--weight-regular)',
      margin: '0 0.1em'
    }
  }, "\u2192"), /*#__PURE__*/React.createElement("span", null, destination));
}
Object.assign(__ds_scope, { RouteChip });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/deal/RouteChip.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.DealCard = __ds_scope.DealCard;

__ds_ns.RouteChip = __ds_scope.RouteChip;

})();
