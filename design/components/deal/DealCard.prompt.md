Main deal listing row. The core repeating unit in the `/deals` page.

```jsx
<DealCard
  destination="Barcelona"
  country="Hiszpania"
  originCode="WAW"
  destinationCode="BCN"
  price={399}
  outboundDate="15 sie"
  returnDate="17 sie"
  airline="Ryanair"
  isGoodDeal={true}
  savingsPercent={28}
  href="https://ryanair.com/..."
/>

// Without good deal badge
<DealCard
  destination="Paryż"
  country="Francja"
  originCode="WAW"
  destinationCode="CDG"
  price={549}
  outboundDate="22 sie"
  returnDate="24 sie"
  airline="LOT"
/>

// Selected state (blue left border)
<DealCard
  destination="Rzym"
  country="Włochy"
  originCode="KRK"
  destinationCode="FCO"
  price={299}
  outboundDate="1 wrz"
  returnDate="3 wrz"
  airline="Wizz Air"
  selected={true}
/>
```

### Notes
- Price uses tabular-nums for stable number alignment in lists
- `isGoodDeal` should only be true for algorithmically confirmed good prices
- `selected` adds a 3px solid blue left border
- "Sprawdź" button opens `href` in new tab
