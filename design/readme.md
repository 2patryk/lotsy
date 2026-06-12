# Lotsy Design System

> **Version:** 1.0  
> **Source:** https://lotsy.pages.dev/deals  
> **Language:** Polish (pl-PL), with UI terminology in Polish

---

## Overview

**Lotsy** (from Polish *"loty"* = flights, colloquial diminutive) is a Polish travel-deals aggregator focused on **tanie weekendy z Polski** — cheap weekend getaways from Polish airports. The product curates short-haul flight + hotel deals departing from major Polish airports (WAW, KRK, GDN, WRO, KTW, POZ) and presents them in a clean, scannable format.

### Core surfaces
| Surface | Description |
|---|---|
| `/deals` | Main deals listing page — filters + deal cards |
| Homepage | Hero + featured destinations |
| Deal detail | Expanded deal with flight info, hotel options |

### Source material
- Live URL: https://lotsy.pages.dev/deals *(JavaScript-rendered SPA; limited fetch access)*
- Color palette: Supplied by product owner (see VISUAL FOUNDATIONS)
- No Figma file or GitHub repo was shared. This design system was authored from the live URL description + color spec. **Provide Figma / codebase links to enable higher-fidelity recreation.**

---

## Content Fundamentals

### Language & voice
- **Language:** Polish (pl-PL) throughout the product UI
- **Tone:** Friendly, direct, deal-savvy. The brand talks like a smart friend who found you a great deal.
- **Register:** Informal *ty* form (second-person singular, e.g. "Znajdź swój lot", not "Znajdź Państwa lot")
- **Casing:** Sentence case throughout — never title-case for UI labels or headings
- **Brand name:** Always "Lotsy" — never "LOTSY", never "lotsy"

### Copy patterns
| Pattern | Example |
|---|---|
| Deal card CTA | "Sprawdź" (Check it) — never "Kup" (Buy) or "Rezerwuj" (Book) |
| Price label | "od 299 PLN" (from 299 PLN) |
| Route format | "WAW → BCN" — always IATA codes, arrow en-dash |
| Date format | "15–17 sie" — abbreviated Polish month names, en-dash range |
| Good deal indicator | "Dobra okazja" — short, enthusiastic, no exclamation mark |
| Filter labels | Single word where possible: "Lotnisko", "Kierunek", "Termin", "Budżet" |

### Emoji & iconography in copy
- **No emoji in product copy.** Emoji are not part of the Lotsy voice.
- Small functional icons (airplane, checkmark, external link) are used sparingly in UI chrome only.

---

## Visual Foundations

### Color system

The Lotsy palette is **almost entirely achromatic** — white backgrounds, gray text, light borders. Blue is the single functional accent; orange is reserved exclusively for the logo. Green signals success only.

| Token | Value | Usage |
|---|---|---|
| `--color-bg` | `#f6f6f6` | Page background |
| `--color-surface` | `#ffffff` | Cards, sidebar, panels |
| `--color-sidebar-active` | `#f3f4f6` | Active nav item |
| `--color-border` | `#e5e7eb` | Row dividers, card borders |
| `--color-text-primary` | `#1a1a1a` | Headings, labels |
| `--color-text-secondary` | `#6b7280` | Meta, helper text |
| `--color-brand` | `#f48120` | **Logo only.** Never for UI states. |
| `--color-blue-700` | `#1d4ed8` | Links, primary buttons, CTAs |
| `--color-blue-600` | `#2563eb` | Active row left border accent |
| `--color-blue-100` | `#dbeafe` | Badge backgrounds (env/type labels) |
| `--color-blue-800` | `#1e40af` | Badge text on blue bg |
| `--color-green-600` | `#16a34a` | Success checkmarks, "good deal" indicator |

**Color discipline rules:**
1. Orange (#f48120) appears **only** in the logo mark. Not for buttons, highlights, or states.
2. Blue is used *functionally* — only for interactive elements, links, and active states.
3. Green is used *only* for confirmed success states (checkmarks, "good deal" label).
4. No gradients anywhere in the UI.

### Typography

Font: **Outfit** (Google Fonts substitution — original font TBD, see ⚠️ in `tokens/fonts.css`)

- **Primary UI font:** Outfit, 400–800 weight range
- **Scale:** 12px–48px, modular steps
- **Body text:** 14px (`--text-sm`), weight 400, line-height 1.5
- **Labels:** 12px (`--text-xs`), weight 500, letter-spacing 0.025em
- **Headings:** 24px–36px, weight 700–800, letter-spacing -0.025em
- **Numbers/prices:** weight 700–800, tabular-nums feature enabled
- **No serif or display typeface.** Pure sans-serif throughout.

### Layout & spacing

- Base unit: **4px**. All spacing is a multiple of 4.
- Content max-width: **1200px**, centered
- Sidebar width: **220px**, fixed left
- Header height: **56px**
- Content padding: **24px**
- Cards: `1px solid var(--color-border)` + `box-shadow: var(--shadow-sm)` + `border-radius: 8px`
- **No rounded pill shapes** for cards. Modest 6–8px radii only.

### Backgrounds

- Page: flat `#f6f6f6` — no texture, no pattern, no gradient
- Cards: pure white on the off-white page bg — contrast comes from the 1px border
- No full-bleed imagery in the deals list. Deal cards may include a small destination thumbnail (60×60px), but imagery is **not** full-bleed or decorative.
- No parallax, no decorative backgrounds.

### Hover & interaction states

| State | Treatment |
|---|---|
| Link hover | Color darkens from `#1d4ed8` → `#1e40af`, underline appears |
| Button hover | Background darkens slightly (8% darker) |
| Button active/press | Slight scale (0.98) |
| Table row hover | Background `#f9fafb` |
| Active table row | Solid `3px` left border in `#2563eb` |
| Sidebar nav item (active) | Background `#f3f4f6`, left 2px border in `#2563eb` |
| Input focus | Blue ring via `box-shadow: var(--shadow-focus)` |

### Borders & shadows

- Cards: `border: 1px solid var(--color-border)` + `box-shadow: var(--shadow-sm)`
- No inner shadow.
- No outer glow.
- Dividers: `1px solid var(--color-border)` — same token everywhere.
- Shadows are extremely subtle — the UI relies on borders, not elevation.

### Animation

- **No decorative animations.** UI is functional-first.
- Transitions: `150ms ease` for color/bg changes, `200ms ease` for opacity
- No bounces, springs, or scroll animations
- Reduced-motion: all transitions are gated on `prefers-reduced-motion: no-preference`

### Corner radii

- Input, button: `6px` (`--radius-md`)
- Card: `8px` (`--radius-lg`)
- Badge/tag/pill: `9999px` (`--radius-full`)
- Modal: `12px` (`--radius-xl`)

### Imagery

- Destination thumbnails: 60×60px or 80×48px, `border-radius: 6px`
- No warm-filtered or heavily-edited imagery — natural, travel-photography style
- No stock-photo "happy travellers" imagery in UI chrome
- Aspect ratios: 4:3 for destination thumbnails, 16:9 for hero if used

---

## Iconography

Icons are used sparingly and never as decoration.

### Approach
- **Icon set:** Lucide Icons (CDN: `https://unpkg.com/lucide@latest`) — thin 1.5px stroke, 24px base size
- **Usage:** Functional only — navigation, form fields, status indicators
- **Size:** 16px in UI labels, 20px in inputs/buttons, 24px in navigation
- **Color:** Inherits text color (`currentColor`) — never colored independently

### Common icons in use
| Icon | Usage |
|---|---|
| `plane` | Flight / departure indicator |
| `calendar` | Date selector |
| `map-pin` | Destination |
| `check-circle` | Good deal / success indicator |
| `external-link` | "Details" link to booking |
| `chevron-down` | Dropdown select |
| `search` | Search field |
| `x` | Close / remove filter tag |
| `arrow-right` | Route arrow (WAW → BCN) |

### What's NOT used
- Emoji as icons
- Filled/solid icon variants (always use stroke/outline style)
- Icon fonts other than Lucide
- PNG icons

---

## File Structure

```
/
├── styles.css               ← global CSS entry (imports only)
├── readme.md                ← this file
├── SKILL.md                 ← agent skill descriptor
│
├── tokens/
│   ├── fonts.css            ← @font-face / Google Fonts import
│   ├── colors.css           ← color custom properties
│   ├── typography.css       ← type scale, weights, leading
│   ├── spacing.css          ← spacing scale, radii, layout vars
│   └── shadows.css          ← shadow tokens
│
├── assets/
│   ├── logo.svg             ← primary logo (on light bg)
│   └── logo-white.svg       ← reversed logo (on dark bg)
│
├── components/
│   ├── core/
│   │   ├── Button.jsx/.d.ts/.prompt.md
│   │   ├── Badge.jsx/.d.ts/.prompt.md
│   │   ├── Card.jsx/.d.ts/.prompt.md
│   │   ├── Input.jsx/.d.ts/.prompt.md
│   │   └── core.card.html   ← @dsCard specimen
│   └── deal/
│       ├── DealCard.jsx/.d.ts/.prompt.md
│       ├── RouteChip.jsx/.d.ts/.prompt.md
│       └── deal.card.html   ← @dsCard specimen
│
├── guidelines/
│   ├── colors-brand.card.html
│   ├── colors-neutral.card.html
│   ├── colors-functional.card.html
│   ├── type-scale.card.html
│   ├── type-weights.card.html
│   ├── spacing.card.html
│   ├── shadows.card.html
│   └── brand.card.html
│
└── ui_kits/
    └── deals/
        └── index.html       ← Lotsy Deals page redesign
```
