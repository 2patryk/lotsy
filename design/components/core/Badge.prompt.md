Compact status label. Renders as a pill. Color = semantic meaning — strictly follow the color rules.

```jsx
// Good deal indicator (only green for confirmed success)
<Badge variant="green">✓ Dobra okazja</Badge>

// Environment / type label
<Badge variant="blue">Plaża</Badge>

// Neutral tag
<Badge variant="neutral">Ryanair</Badge>

// With dot indicator
<Badge variant="amber" dot>Ostatnie miejsca</Badge>

// Error / unavailable
<Badge variant="red">Wygasła</Badge>
```

### Color rules (non-negotiable)
| Variant | Use case |
|---|---|
| `neutral` | Airline name, generic tags |
| `blue` | Category labels, environment type, info |
| `green` | "Dobra okazja", confirmed success — never for decoration |
| `amber` | Warnings: expiring soon, limited seats |
| `red` | Errors, expired deals |
