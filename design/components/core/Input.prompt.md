Text input for forms and filter bars. Supports leading icon, label, hint, and error.

```jsx
// Search with icon
<Input
  placeholder="Szukaj destynacji..."
  icon={<IconSearch size={14} />}
/>

// Form field with label and hint
<Input
  label="Email"
  type="email"
  placeholder="jan@example.com"
  hint="Wyślemy alert na ten adres"
/>

// Validation error
<Input
  label="Lotnisko wylotu"
  value={airport}
  error="Wybierz co najmniej jedno lotnisko"
/>

// Disabled
<Input label="IATA" value="WAW" disabled />
```

### Notes
- Label is always uppercase, small size — matches design spec
- Focus ring uses `--shadow-focus` (blue, accessible)
- Error border is red; focus border is blue; default is `--color-border`
