Inline IATA route chip. Always shows origin → destination in monospace-weight uppercase.

```jsx
// Default
<RouteChip origin="WAW" destination="BCN" />

// Small — inside a table cell or badge row
<RouteChip origin="KRK" destination="LGW" size="sm" />

// Large — in deal detail header
<RouteChip origin="WAW" destination="FCO" size="lg" />
```

### Notes
- IATA codes should always be uppercase
- The arrow (→) is a lighter color than the codes
- Background is `--color-sidebar-active` (light gray pill)
