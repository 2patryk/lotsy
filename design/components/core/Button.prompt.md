Primary interactive control. Use for form submissions, CTAs, and navigational actions.

```jsx
// Primary CTA — used for "Sprawdź" (Check deal)
<Button variant="primary" size="md">Sprawdź</Button>

// Secondary — filter confirm, cancel
<Button variant="secondary" size="sm">Wróć</Button>

// Ghost — low-emphasis toolbar actions
<Button variant="ghost" size="sm" icon={<IconSearch size={14} />}>Szukaj</Button>

// Danger — destructive actions
<Button variant="danger" size="sm">Usuń alert</Button>

// Disabled
<Button variant="primary" disabled>Niedostępne</Button>

// Full width — e.g. in mobile filter drawer
<Button variant="primary" fullWidth>Zastosuj filtry</Button>
```

### Variants
| Variant | Use case |
|---|---|
| `primary` | Main CTA: "Sprawdź", "Szukaj lotów" |
| `secondary` | Secondary actions, cancel, back |
| `ghost` | Toolbar icons, nav actions |
| `danger` | Destructive: delete alert, remove |

### Size guidance
- `sm` — inline with content, table rows, filter chips
- `md` — default; standard forms and cards
- `lg` — hero CTAs, standalone action areas
