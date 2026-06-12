Base surface container. Never add custom borders or backgrounds inside — let the Card control its own chrome.

```jsx
// Basic info card
<Card padding="md">
  <p>Treść karty</p>
</Card>

// Clickable deal card with hover effect
<Card hoverable onClick={() => openDeal(id)}>
  <DealCard {...deal} />
</Card>

// Active / selected state (blue left border)
<Card active>
  <p>Wybrany element</p>
</Card>

// No padding — for cards with full-bleed image header
<Card padding="none">
  <img src={thumbnail} style={{ borderRadius: '8px 8px 0 0', width: '100%' }} />
  <div style={{ padding: 'var(--space-4)' }}>
    <p>Barcelona</p>
  </div>
</Card>
```
