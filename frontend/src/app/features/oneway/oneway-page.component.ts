import {
  Component,
  inject,
  signal,
  computed,
  effect,
  HostListener,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { OneWayService } from '../../core/services/oneway.service';
import type { OneWayDirection, OneWayFare, OneWayMeta } from '../../core/models/oneway-fare.model';

const WD = ['ndz', 'pon', 'wt', 'śr', 'czw', 'pt', 'sob'];
const MON = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'];

const DAYS = [
  { js: 1, label: 'Pn' },
  { js: 2, label: 'Wt' },
  { js: 3, label: 'Śr' },
  { js: 4, label: 'Cz' },
  { js: 5, label: 'Pt' },
  { js: 6, label: 'Sb' },
  { js: 0, label: 'Nd' },
];

// Diacritic- and case-insensitive normalization, e.g. "wlochy" matches "Włochy".
function normalize(s: string): string {
  return (
    s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      // NFD does not decompose stroked letters, so map Polish l-stroke by hand.
      .replace(/[łŁ]/g, 'l')
      .toLowerCase()
  );
}

interface DestSuggestion {
  kind: 'country' | 'city' | 'airport';
  name: string;
  country?: string;
  iata?: string;
}

interface PlAirportSuggestion {
  iata: string;
  city: string;
}

const MAX_DEST_SUGGESTIONS = 12;
const MAX_PL_AIRPORT_SUGGESTIONS = 12;

@Component({
  selector: 'app-oneway-page',
  standalone: true,
  imports: [CommonModule, RouterLink, DecimalPipe],
  template: `
    <header class="site-header">
      <div class="header-inner">
        <a [routerLink]="['/deals']" class="logo-link" aria-label="Lotsy">
          <svg width="110" height="32" viewBox="0 0 122 36" fill="none">
            <circle cx="18" cy="18" r="16" fill="#f48120" />
            <g transform="translate(8.5,9.5) scale(0.85)">
              <path
                fill="white"
                d="M23 10 L17 8 L10 1 L8 3 L13 8 L4 8 L2 6 L1 10 L2 14 L4 12 L13 12 L8 17 L10 19 L17 12 Z"
              />
            </g>
            <text
              x="42"
              y="24"
              font-family="Outfit,system-ui,sans-serif"
              font-weight="800"
              font-size="20"
              fill="#1a1a1a"
              letter-spacing="-0.5"
            >
              Lotsy
            </text>
          </svg>
        </a>
        <nav class="main-nav">
          <a class="nav-item" [routerLink]="['/deals']">Okazje</a>
          <a class="nav-item" [routerLink]="['/czartery']">Czartery</a>
          <span class="nav-item active">W jedną stronę</span>
        </nav>
      </div>
    </header>

    <main class="page">
      <div class="page-head">
        <h1>Loty w jedną stronę</h1>
        <p>
          Bilety Ryanair bez przesiadek · cena za osobę
          @if (lastUpdate()) {
            <span class="muted"> · Odświeżono: {{ lastUpdate() }}</span>
          }
        </p>
      </div>

      <!-- Mobile-only filters trigger; the filter card itself becomes a full-screen
           overlay on mobile via the filter-card--open class (see media queries). -->
      <button type="button" class="filters-trigger" (click)="filtersOpen.set(true)">
        <span>Filtry</span>
        @if (filterCount() > 0) {
          <span class="filters-badge">{{ filterCount() }}</span>
        }
      </button>

      <!-- ── Filters ─────────────────────────── -->
      <div class="filter-card" [class.filter-card--open]="filtersOpen()">
        <div class="filter-card-head">
          <span class="filter-card-title">Filtry</span>
          <button
            type="button"
            class="filter-card-close"
            (click)="closeFilters()"
            aria-label="Zamknij"
          >
            ×
          </button>
        </div>
        <div class="filter-card-body">
          <div class="filter-row">
            <!-- Direction -->
            <div class="fg">
              <span class="fg-label">Kierunek</span>
              <div class="mode-toggle" role="tablist">
                <button
                  class="mode-btn"
                  role="tab"
                  [class.active]="direction() === 'OUT'"
                  (click)="setDirection('OUT')"
                >
                  Z Polski
                </button>
                <button
                  class="mode-btn"
                  role="tab"
                  [class.active]="direction() === 'IN'"
                  (click)="setDirection('IN')"
                >
                  Do Polski
                </button>
              </div>
            </div>

            <!-- PL airport autocomplete -->
            <div class="fg fg-dest" (click)="$event.stopPropagation()">
              <span class="fg-label">Lotnisko polskie</span>
              <div class="dest-box" [class.dd-active]="selectedPlAirports().length > 0">
                @if (selectedPlAirports().length) {
                  <div class="dest-chips">
                    @for (a of selectedPlAirports(); track a.iata) {
                      <span class="dest-chip">
                        {{ a.city }} ({{ a.iata }})
                        <button
                          type="button"
                          class="dest-chip-x"
                          (click)="removePlAirportItem(a)"
                          aria-label="Usuń"
                        >
                          ×
                        </button>
                      </span>
                    }
                  </div>
                }
                <input
                  #plAirportInputEl
                  class="dest-input"
                  type="text"
                  placeholder="Miasto lub kod…"
                  [value]="plAirportInput()"
                  (input)="onPlAirportInput($event)"
                  (focus)="onPlAirportFocus()"
                  (keydown)="onPlAirportKeydown($event)"
                />
              </div>
              @if (plAirportPanelOpen() && plAirportSuggestions().length) {
                <div class="dd-panel dest-panel">
                  @for (a of plAirportSuggestions(); track a.iata; let i = $index) {
                    <div
                      class="dd-opt dest-opt"
                      [class.dest-opt-active]="i === plAirportHighlight()"
                      (mouseenter)="plAirportHighlight.set(i)"
                      (mousedown)="$event.preventDefault()"
                      (click)="selectPlAirportSuggestion(a)"
                    >
                      <span class="dest-opt-name">{{ a.city }} ({{ a.iata }})</span>
                    </div>
                  }
                </div>
              }
            </div>

            <!-- Country / city autocomplete -->
            <div class="fg fg-dest" (click)="$event.stopPropagation()">
              <span class="fg-label">{{ direction() === 'OUT' ? 'Dokąd' : 'Skąd' }}</span>
              <div class="dest-box" [class.dd-active]="hasDestSelection()">
                @if (selectedDest().length) {
                  <div class="dest-chips">
                    @for (s of selectedDest(); track s.kind + '|' + s.name + '|' + (s.iata ?? '')) {
                      <span class="dest-chip">
                        {{ s.kind === 'airport' ? s.name + ' (' + s.iata + ')' : s.name }}
                        <button
                          type="button"
                          class="dest-chip-x"
                          (click)="removeDestItem(s)"
                          aria-label="Usuń"
                        >
                          ×
                        </button>
                      </span>
                    }
                  </div>
                }
                <input
                  #destInputEl
                  class="dest-input"
                  type="text"
                  placeholder="Kraj lub miasto…"
                  [value]="destInput()"
                  (input)="onDestInput($event)"
                  (focus)="onDestFocus()"
                  (keydown)="onDestKeydown($event)"
                />
              </div>
              @if (destPanelOpen() && destSuggestions().length) {
                <div class="dd-panel dest-panel">
                  @for (
                    s of destSuggestions();
                    track s.kind + '|' + s.name + '|' + (s.iata ?? '');
                    let i = $index
                  ) {
                    <div
                      class="dd-opt dest-opt"
                      [class.dest-opt-active]="i === destHighlight()"
                      (mouseenter)="destHighlight.set(i)"
                      (mousedown)="$event.preventDefault()"
                      (click)="selectDestSuggestion(s)"
                    >
                      <span class="dest-opt-name">
                        {{ s.kind === 'airport' ? s.name + ' (' + s.iata + ')' : s.name }}
                        @if (s.kind === 'city' || s.kind === 'airport') {
                          <span class="dest-opt-country">({{ s.country }})</span>
                        }
                      </span>
                      <span class="dest-opt-tag">{{
                        s.kind === 'country' ? 'kraj' : s.kind === 'city' ? 'miasto' : 'lotnisko'
                      }}</span>
                    </div>
                  }
                </div>
              }
            </div>

            <!-- Date range -->
            <div class="fg">
              <span class="fg-label">Wylot od</span>
              <input
                class="date-input"
                type="date"
                [value]="dateFrom()"
                [min]="minDate()"
                [max]="maxDate()"
                (change)="setDateFrom($event)"
              />
            </div>
            <div class="fg">
              <span class="fg-label">Wylot do</span>
              <input
                class="date-input"
                type="date"
                [value]="dateTo()"
                [min]="minDate()"
                [max]="maxDate()"
                (change)="setDateTo($event)"
              />
            </div>
          </div>

          <!-- Row 2: day-of-week pills + price range + sort + reset -->
          <div class="filter-row filter-row--secondary">
            <div class="fg">
              <span class="fg-label">Dni tygodnia wylotu</span>
              <div class="day-pills">
                @for (d of DAYS; track d.js) {
                  <button
                    class="day-pill"
                    [class.on]="selectedDays().has(d.js)"
                    (click)="toggleDay(d.js)"
                  >
                    {{ d.label }}
                  </button>
                }
              </div>
            </div>
            <div class="fg">
              <span class="fg-label">Maks. cena (zł)</span>
              <input
                class="price-input"
                type="number"
                min="0"
                placeholder="max"
                [value]="maxPrice() ?? ''"
                (change)="setMaxPrice($event)"
              />
            </div>
            <div class="fg">
              <span class="fg-label">Sortowanie</span>
              <select class="sort-select" [value]="sort()" (change)="setSort($event)">
                <option value="price">Najtańsze najpierw</option>
                <option value="date">Data wylotu</option>
              </select>
            </div>
            @if (hasFilters()) {
              <button class="clear-btn" (click)="clearFilters()">Wyczyść filtry</button>
            }
          </div>
        </div>
        <div class="filter-card-foot">
          @if (hasFilters()) {
            <button class="filter-foot-clear" (click)="clearFilters()">Wyczyść</button>
          }
          <button type="button" class="filter-foot-show" (click)="closeFilters()">
            Pokaż wyniki ({{ fares().length }})
          </button>
        </div>
      </div>

      <div class="toolbar">
        <span class="count">
          {{ fares().length }} lotów
          @if (fares().length === 300) {
            <span class="muted">(pokazuję pierwsze 300)</span>
          }
        </span>
      </div>

      @if (loading()) {
        <div class="state-info">Ładowanie…</div>
      } @else if (error()) {
        <div class="state-info error">Nie udało się pobrać ofert. Spróbuj ponownie później.</div>
      } @else if (fares().length === 0) {
        <div class="state-info">Brak lotów dla wybranych filtrów.</div>
      } @else {
        <div class="results-card">
          @for (f of fares(); track f.id) {
            <div class="offer-row">
              <!-- ── Left ─────────────────────── -->
              <div class="offer-left">
                <div class="dest-header">
                  <span class="dest-city">{{ f.originCity }} → {{ f.destCity }}</span>
                  <span class="dest-sep">·</span>
                  <!-- Show the foreign-side country: destination when flying
                       out of Poland, origin when flying back in. -->
                  <span class="dest-country">{{
                    direction() === 'IN' ? f.originCountry : f.destCountry
                  }}</span>
                </div>

                <div class="leg">
                  <span class="dep-highlight">
                    <span class="dep-date">{{ fmtDate(f.date) }}</span>
                    <span class="dep-hour">{{ fmtTime(f.departureTime) }}</span>
                    <span class="dep-airport"
                      >{{ f.originCity }} <span class="dep-code">({{ f.origin }})</span></span
                    >
                  </span>
                  <span class="leg-route">
                    <span class="leg-arrow">→</span>
                    <strong>{{ f.destCity }}</strong>
                    <span class="leg-code">({{ f.destination }})</span>
                    <span class="leg-arr">przylot {{ fmtTime(f.arrivalTime) }}</span>
                  </span>
                  <span class="chip chip-neutral"
                    >Ryanair
                    @if (f.flightNumber) {
                      <span class="chip-sub">{{ f.flightNumber }}</span>
                    }
                  </span>
                </div>
              </div>

              <!-- ── Right ────────────────────── -->
              <div class="offer-right">
                <div class="price-block">
                  <div class="price-val">
                    {{ f.price | number: '1.0-0' }}
                    <span class="price-cur">{{ f.currency }}</span>
                  </div>
                  <div class="price-mode">w jedną stronę</div>
                </div>
                <a class="btn-primary" [href]="bookingUrl(f)" target="_blank" rel="noopener"
                  >Sprawdź</a
                >
              </div>
            </div>
          }
        </div>
      }
    </main>
  `,
  styles: [
    `
      .site-header {
        position: sticky;
        top: 0;
        z-index: 200;
        height: var(--header-h);
        background: var(--color-surface);
        border-bottom: 1px solid var(--color-border);
      }
      .header-inner {
        max-width: 1060px;
        margin: 0 auto;
        padding: 0 24px;
        height: 100%;
        display: flex;
        align-items: center;
        gap: 24px;
      }
      .logo-link {
        display: flex;
        align-items: center;
      }
      .main-nav {
        display: flex;
        gap: 4px;
      }
      .nav-item {
        padding: 5px 12px;
        border-radius: var(--radius-md);
        border: none;
        font-size: 14px;
        font-weight: 400;
        cursor: pointer;
        color: var(--color-text-secondary);
        background: transparent;
        text-decoration: none;
        transition: all 0.12s;
      }
      .nav-item.active {
        font-weight: 600;
        color: var(--color-blue-700);
        background: var(--color-blue-50);
        cursor: default;
      }

      @media (max-width: 768px) {
        .header-inner {
          padding: 0 12px;
          gap: 10px;
        }
        .logo-link svg {
          width: 84px;
          height: 26px;
        }
        .main-nav {
          flex: 1 1 auto;
          min-width: 0;
          overflow-x: auto;
          flex-wrap: nowrap;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
        }
        .main-nav::-webkit-scrollbar {
          display: none;
        }
        .nav-item {
          flex-shrink: 0;
          white-space: nowrap;
          display: inline-flex;
          align-items: center;
          min-height: 40px;
          padding: 0 12px;
          box-sizing: border-box;
        }
      }

      .page {
        max-width: 1060px;
        margin: 0 auto;
        padding: 28px 24px 48px;
      }
      .page-head h1 {
        margin: 0;
        font-size: 22px;
        font-weight: 700;
        color: var(--color-text-primary);
      }
      .page-head p {
        margin: 6px 0 0;
        font-size: 14px;
        color: var(--color-text-secondary);
      }
      .muted {
        color: var(--color-text-tertiary);
      }

      /* ── Mobile filters trigger (hidden on desktop) ─── */
      .filters-trigger {
        display: none;
      }

      /* ── Filter card ─────────────────────── */
      .filter-card {
        margin-top: 20px;
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-lg);
        padding: 14px 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
        box-shadow: var(--shadow-sm);
      }
      /* Header/footer of the filter card only render as an overlay chrome on mobile. */
      .filter-card-head,
      .filter-card-foot {
        display: none;
      }
      .filter-card-body {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .filter-row {
        display: flex;
        align-items: flex-end;
        gap: 16px;
        flex-wrap: wrap;
      }
      .filter-row--secondary {
        justify-content: space-between;
      }
      .fg {
        display: flex;
        flex-direction: column;
        gap: 5px;
        position: relative;
      }
      .fg-label {
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--color-text-tertiary);
      }

      .mode-toggle {
        display: inline-flex;
        background: var(--color-sidebar-active);
        border-radius: var(--radius-md);
        padding: 3px;
        gap: 2px;
      }
      .mode-btn {
        border: none;
        background: transparent;
        padding: 5px 12px;
        font-size: 13px;
        font-weight: 500;
        color: var(--color-text-secondary);
        border-radius: calc(var(--radius-md) - 2px);
        cursor: pointer;
        transition: all 0.12s;
      }
      .mode-btn.active {
        background: var(--color-surface);
        color: var(--color-blue-700);
        font-weight: 600;
        box-shadow: var(--shadow-sm);
      }

      .dd-btn {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        min-width: 160px;
        padding: 7px 10px;
        font-size: 13px;
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        background: var(--color-surface);
        color: var(--color-text-primary);
        cursor: pointer;
        transition: border-color 0.12s;
      }
      .dd-btn:hover {
        border-color: var(--color-border-strong);
      }
      .dd-btn.dd-active {
        border-color: var(--color-blue-600);
        color: var(--color-blue-700);
        font-weight: 600;
      }
      .chevron {
        transition: transform 0.15s;
        color: var(--color-text-tertiary);
        flex-shrink: 0;
      }
      .chevron.flip {
        transform: rotate(180deg);
      }
      .dd-panel {
        position: absolute;
        top: calc(100% + 6px);
        left: 0;
        z-index: 300;
        min-width: 220px;
        max-height: 280px;
        overflow-y: auto;
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        box-shadow: var(--shadow-md, 0 8px 24px rgba(0, 0, 0, 0.12));
        padding: 6px;
      }
      .dd-opt {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 8px;
        font-size: 13px;
        color: var(--color-text-primary);
        border-radius: var(--radius-sm);
        cursor: pointer;
      }
      .dd-opt:hover {
        background: var(--color-surface-hover);
      }
      .dd-code {
        color: var(--color-text-tertiary);
      }

      /* ── Country/city autocomplete ───────── */
      .dest-box {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px;
        min-width: 220px;
        max-width: 340px;
        padding: 5px 8px;
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        background: var(--color-surface);
        cursor: text;
        transition: border-color 0.12s;
      }
      .dest-box:hover {
        border-color: var(--color-border-strong);
      }
      .dest-box:focus-within,
      .dest-box.dd-active {
        border-color: var(--color-blue-600);
      }
      .dest-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
      .dest-chip {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 3px 4px 3px 10px;
        font-size: 12px;
        font-weight: 600;
        border-radius: 999px;
        background: var(--color-blue-50);
        color: var(--color-blue-700);
        white-space: nowrap;
      }
      .dest-chip-x {
        border: none;
        background: transparent;
        color: inherit;
        font-size: 14px;
        line-height: 1;
        cursor: pointer;
        padding: 0 3px;
      }
      .dest-chip-x:hover {
        opacity: 0.7;
      }
      .dest-input {
        flex: 1 1 80px;
        min-width: 80px;
        border: none;
        outline: none;
        background: transparent;
        font-size: 13px;
        font-family: inherit;
        color: var(--color-text-primary);
        padding: 2px 0;
      }
      .dest-panel {
        min-width: 280px;
        max-height: 280px;
      }
      .dest-opt {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }
      .dd-opt.dest-opt-active {
        background: var(--color-surface-hover);
      }
      .dest-opt-name {
        display: flex;
        align-items: baseline;
        gap: 6px;
      }
      .dest-opt-country {
        font-size: 11px;
        color: var(--color-text-tertiary);
      }
      .dest-opt-tag {
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.03em;
        color: var(--color-text-tertiary);
        background: var(--color-sidebar-active);
        padding: 2px 6px;
        border-radius: 999px;
        flex-shrink: 0;
      }

      .date-input,
      .price-input,
      .sort-select {
        padding: 6px 10px;
        font-size: 13px;
        font-family: inherit;
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        background: var(--color-surface);
        color: var(--color-text-primary);
      }
      .price-input {
        width: 90px;
      }

      .day-pills {
        display: flex;
        gap: 4px;
      }
      .day-pill {
        min-width: 36px;
        padding: 5px 8px;
        font-size: 12px;
        font-weight: 600;
        border: 1px solid var(--color-border);
        border-radius: 999px;
        background: var(--color-surface);
        color: var(--color-text-secondary);
        cursor: pointer;
        transition: all 0.12s;
      }
      .day-pill.on {
        background: var(--color-blue-50);
        border-color: var(--color-blue-600);
        color: var(--color-blue-700);
      }

      .clear-btn {
        border: none;
        background: transparent;
        font-size: 12px;
        font-weight: 600;
        color: var(--color-text-secondary);
        cursor: pointer;
        padding: 6px 8px;
        border-radius: var(--radius-sm);
      }
      .clear-btn:hover {
        background: var(--color-surface-hover);
        color: var(--color-text-primary);
      }

      /* ── Mobile filters: sticky trigger + full-screen overlay ─── */
      @media (max-width: 768px) {
        .filters-trigger {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 100%;
          margin-top: 16px;
          padding: 12px 16px;
          min-height: 44px;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          background: var(--color-surface);
          color: var(--color-text-primary);
          font-size: 14px;
          font-weight: 600;
          box-shadow: var(--shadow-sm);
          box-sizing: border-box;
          position: sticky;
          top: calc(var(--header-h) + 8px);
          z-index: 150;
        }
        .filters-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 18px;
          height: 18px;
          padding: 0 5px;
          border-radius: 999px;
          background: var(--color-blue-700);
          color: #fff;
          font-size: 11px;
          font-weight: 700;
        }

        /* Filter card is hidden inline; it becomes a full-screen overlay when open. */
        .filter-card {
          display: none;
          margin-top: 0;
        }
        .filter-card.filter-card--open {
          display: flex;
          position: fixed;
          inset: 0;
          z-index: 500;
          border-radius: 0;
          border: none;
          box-shadow: none;
          padding: 0;
          gap: 0;
        }
        .filter-card-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-shrink: 0;
          padding: 14px 16px;
          border-bottom: 1px solid var(--color-border);
        }
        .filter-card-title {
          font-size: 16px;
          font-weight: 700;
          color: var(--color-text-primary);
        }
        .filter-card-close {
          border: none;
          background: transparent;
          font-size: 26px;
          line-height: 1;
          color: var(--color-text-secondary);
          cursor: pointer;
          min-width: 40px;
          min-height: 40px;
        }
        .filter-card-body {
          flex: 1 1 auto;
          overflow-y: auto;
          padding: 16px;
          gap: 20px;
        }
        .filter-card-foot {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-shrink: 0;
          padding: 12px 16px;
          border-top: 1px solid var(--color-border);
          background: var(--color-surface);
        }
        .filter-foot-clear {
          flex-shrink: 0;
          border: 1px solid var(--color-border);
          background: var(--color-surface);
          color: var(--color-text-secondary);
          font-size: 13px;
          font-weight: 600;
          padding: 12px 14px;
          border-radius: var(--radius-md);
          cursor: pointer;
          min-height: 44px;
        }
        .filter-foot-show {
          flex: 1 1 auto;
          border: none;
          background: var(--color-blue-700);
          color: #fff;
          font-size: 14px;
          font-weight: 700;
          padding: 12px 14px;
          border-radius: var(--radius-md);
          cursor: pointer;
          min-height: 44px;
        }

        /* Stack all controls full-width and comfortably sized inside the overlay. */
        .filter-row,
        .filter-row--secondary {
          flex-direction: column;
          align-items: stretch;
          gap: 16px;
        }
        .fg {
          width: 100%;
        }
        .fg-dest {
          max-width: none;
        }
        .dest-box {
          max-width: none;
          min-height: 44px;
          box-sizing: border-box;
        }
        .mode-toggle {
          width: 100%;
        }
        .mode-btn {
          flex: 1 1 0;
          padding: 10px 12px;
        }
        .date-input,
        .price-input,
        .sort-select {
          width: 100%;
          min-height: 44px;
          box-sizing: border-box;
        }
        .day-pills {
          flex-wrap: wrap;
        }
        .day-pill {
          min-height: 36px;
        }

        /* Suggestion panels render in normal flow below the field instead of being
           absolutely positioned, so they can't get clipped by the overlay. */
        .dd-panel {
          position: static;
          margin-top: 8px;
          min-width: 0;
          box-shadow: none;
        }
      }

      .toolbar {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        margin: 14px 0 10px;
      }
      .count {
        font-size: 13px;
        color: var(--color-text-tertiary);
      }

      .state-info {
        padding: 60px 20px;
        text-align: center;
        font-size: 14px;
        color: var(--color-text-secondary);
      }
      .state-info.error {
        color: var(--color-amber-700);
      }

      /* ── Results list (same look as charters) ── */
      .results-card {
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-lg);
        overflow: hidden;
        box-shadow: var(--shadow-sm);
      }

      .offer-row {
        display: grid;
        grid-template-columns: 1fr auto;
        align-items: center;
        gap: 24px;
        padding: 14px 20px;
        position: relative;
        background: var(--color-surface);
        border-bottom: 1px solid var(--color-border);
        transition: background-color 0.1s;
      }
      .offer-row:last-child {
        border-bottom: none;
      }
      .offer-row:hover {
        background: var(--color-surface-hover);
      }

      .offer-left {
        display: flex;
        flex-direction: column;
        gap: 10px;
        min-width: 0;
        position: relative;
        z-index: 1;
      }

      .dest-header {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
      }
      .dest-city {
        font-size: 15px;
        font-weight: 700;
        color: var(--color-text-primary);
      }
      .dest-sep {
        color: var(--color-border-strong);
      }
      .dest-country {
        font-size: 13px;
        color: var(--color-text-secondary);
      }

      .leg {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
        font-size: 13px;
      }

      /* Emphasized: date + hour + departure airport */
      .dep-highlight {
        display: inline-flex;
        align-items: baseline;
        gap: 8px;
        padding: 3px 10px;
        border-radius: var(--radius-md);
        background: var(--color-blue-50);
        white-space: nowrap;
      }
      .dep-date {
        font-size: 13px;
        font-weight: 700;
        color: var(--color-blue-700);
      }
      .dep-hour {
        font-size: 15px;
        font-weight: 800;
        color: var(--color-blue-700);
        font-variant-numeric: tabular-nums;
      }
      .dep-airport {
        font-size: 13px;
        font-weight: 700;
        color: var(--color-text-primary);
      }
      .dep-code {
        font-weight: 500;
        color: var(--color-text-tertiary);
      }

      .leg-route {
        display: flex;
        align-items: center;
        gap: 4px;
        flex-wrap: wrap;
        font-size: 13px;
        color: var(--color-text-primary);
      }
      .leg-route strong {
        font-weight: 600;
      }
      .leg-code {
        color: var(--color-text-tertiary);
        font-weight: 400;
      }
      .leg-arrow {
        color: var(--color-text-tertiary);
        margin: 0 2px;
      }
      .leg-arr {
        color: var(--color-text-secondary);
        margin-left: 4px;
        font-variant-numeric: tabular-nums;
      }

      .chip {
        font-size: 11px;
        font-weight: 600;
        padding: 2px 8px;
        border-radius: 999px;
        white-space: nowrap;
      }
      .chip-neutral {
        background: var(--color-sidebar-active);
        color: var(--color-text-secondary);
      }
      .chip-sub {
        font-weight: 400;
        color: var(--color-text-tertiary);
      }

      .offer-right {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 10px;
        flex-shrink: 0;
        position: relative;
        z-index: 1;
      }
      .price-block {
        text-align: right;
      }
      .price-val {
        font-size: 20px;
        font-weight: 800;
        color: var(--color-blue-700);
        line-height: 1.1;
        white-space: nowrap;
      }
      .price-cur {
        font-size: 12px;
        font-weight: 600;
      }
      .price-mode {
        font-size: 11px;
        color: var(--color-text-tertiary);
        margin-top: 2px;
      }
      .btn-primary {
        display: inline-flex;
        align-items: center;
        padding: 6px 16px;
        border-radius: var(--radius-md);
        font-size: 13px;
        font-weight: 500;
        background: var(--color-blue-700);
        color: #fff;
        text-decoration: none;
        transition: background 0.12s;
      }
      .btn-primary:hover {
        background: var(--color-blue-800);
      }

      @media (max-width: 768px) {
        .offer-row {
          grid-template-columns: 1fr;
          gap: 12px;
          padding: 14px 16px;
        }
        .dest-header,
        .leg {
          flex-wrap: wrap;
        }
        .dep-highlight {
          white-space: normal;
          flex-wrap: wrap;
        }
        .offer-right {
          flex-direction: column;
          align-items: stretch;
          width: 100%;
          gap: 10px;
        }
        .price-block {
          text-align: left;
        }
        .btn-primary {
          width: 100%;
          justify-content: center;
          padding: 12px 16px;
          font-size: 14px;
          min-height: 44px;
          box-sizing: border-box;
        }
      }
    `,
  ],
})
export class OneWayPageComponent {
  private oneWayService = inject(OneWayService);

  @ViewChild('destInputEl') destInputEl?: ElementRef<HTMLInputElement>;
  @ViewChild('plAirportInputEl') plAirportInputEl?: ElementRef<HTMLInputElement>;

  readonly DAYS = DAYS;

  direction = signal<OneWayDirection>('OUT');
  loading = signal(true);
  error = signal(false);
  fares = signal<OneWayFare[]>([]);
  meta = signal<OneWayMeta>({
    plAirports: [],
    countries: [],
    cities: [],
    airports: [],
    dateMin: null,
    dateMax: null,
    lastUpdated: null,
  });

  // Ordered list of selected country/city/airport chips (order preserved for backspace removal).
  selectedDest = signal<DestSuggestion[]>([]);
  destInput = signal('');
  destPanelOpen = signal(false);
  destHighlight = signal(0);

  // Ordered list of selected Polish-airport chips.
  selectedPlAirports = signal<PlAirportSuggestion[]>([]);
  plAirportInput = signal('');
  plAirportPanelOpen = signal(false);
  plAirportHighlight = signal(0);

  selectedDays = signal<Set<number>>(new Set());
  dateFrom = signal<string>('');
  dateTo = signal<string>('');
  maxPrice = signal<number | null>(null);
  sort = signal<'price' | 'date'>('price');

  // Mobile-only filters overlay (CSS-driven; see `.filter-card--open` media queries).
  filtersOpen = signal(false);

  lastUpdate = computed(() => {
    const ts = this.meta().lastUpdated;
    if (!ts) return null;
    return new Date(ts).toLocaleString('pl-PL', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  });
  minDate = computed(() => this.meta().dateMin?.slice(0, 10) ?? '');
  maxDate = computed(() => this.meta().dateMax?.slice(0, 10) ?? '');

  hasDestSelection = computed(() => this.selectedDest().length > 0);
  hasFilters = computed(
    () =>
      this.selectedPlAirports().length > 0 ||
      this.selectedDest().length > 0 ||
      this.selectedDays().size > 0 ||
      !!this.dateFrom() ||
      !!this.dateTo() ||
      this.maxPrice() != null,
  );
  // Count of active filter categories, shown as a badge on the mobile "Filtry" button.
  filterCount = computed(() => {
    let n = 0;
    if (this.selectedPlAirports().length > 0) n++;
    if (this.selectedDest().length > 0) n++;
    if (this.selectedDays().size > 0) n++;
    if (this.dateFrom() || this.dateTo()) n++;
    if (this.maxPrice() != null) n++;
    return n;
  });

  // Countries first, then cities, then airports, prefix/substring matched, diacritic- and
  // case-insensitive. Excludes already-selected items. Airports only surface when the query
  // matches their IATA code (city queries are already covered by the city suggestions, so
  // matching airports by city name too would duplicate every city with its airports).
  // Shows the full list (countries + cities, no airports) when input is empty.
  destSuggestions = computed<DestSuggestion[]>(() => {
    const query = normalize(this.destInput().trim());
    const selected = this.selectedDest();
    const selectedCountries = new Set(
      selected.filter((s) => s.kind === 'country').map((s) => s.name),
    );
    const selectedCities = new Set(selected.filter((s) => s.kind === 'city').map((s) => s.name));
    const selectedAirports = new Set(
      selected.filter((s) => s.kind === 'airport').map((s) => s.iata),
    );

    const countries: DestSuggestion[] = this.meta()
      .countries.filter(
        (c) => !selectedCountries.has(c) && (!query || normalize(c).includes(query)),
      )
      .map((name) => ({ kind: 'country', name }));

    const cities: DestSuggestion[] = this.meta()
      .cities.filter(
        (c) => !selectedCities.has(c.name) && (!query || normalize(c.name).includes(query)),
      )
      .map((c) => ({ kind: 'city', name: c.name, country: c.country }));

    const airports: DestSuggestion[] = query
      ? this.meta()
          .airports.filter(
            (a) => !selectedAirports.has(a.iata) && normalize(a.iata).includes(query),
          )
          .map((a) => ({ kind: 'airport', name: a.city, country: a.country, iata: a.iata }))
      : [];

    return [...countries, ...cities, ...airports].slice(0, MAX_DEST_SUGGESTIONS);
  });

  // Polish-side airport suggestions: match by city name or IATA code, diacritic-insensitive.
  plAirportSuggestions = computed<PlAirportSuggestion[]>(() => {
    const query = normalize(this.plAirportInput().trim());
    const selected = new Set(this.selectedPlAirports().map((a) => a.iata));
    return this.meta()
      .plAirports.filter(
        (a) =>
          !selected.has(a.iata) &&
          (!query || normalize(a.city).includes(query) || normalize(a.iata).includes(query)),
      )
      .slice(0, MAX_PL_AIRPORT_SUGGESTIONS);
  });

  constructor() {
    this.loadMeta();
    this.load();
    // Lock body scroll while the mobile filters overlay is open.
    effect(() => {
      document.body.style.overflow = this.filtersOpen() ? 'hidden' : '';
    });
  }

  @HostListener('document:click')
  closeDropdowns() {
    this.destPanelOpen.set(false);
    this.plAirportPanelOpen.set(false);
  }

  closeFilters() {
    this.filtersOpen.set(false);
  }

  setDirection(direction: OneWayDirection) {
    if (this.direction() === direction) return;
    this.direction.set(direction);
    // Filters depend on direction-specific meta (airports/countries/cities/date range).
    this.selectedPlAirports.set([]);
    this.plAirportInput.set('');
    this.plAirportPanelOpen.set(false);
    this.selectedDest.set([]);
    this.destInput.set('');
    this.destPanelOpen.set(false);
    this.selectedDays.set(new Set());
    this.dateFrom.set('');
    this.dateTo.set('');
    this.maxPrice.set(null);
    this.loadMeta();
    this.load();
  }

  onPlAirportInput(e: Event) {
    this.plAirportInput.set((e.target as HTMLInputElement).value);
    this.plAirportPanelOpen.set(true);
    this.plAirportHighlight.set(0);
  }

  onPlAirportFocus() {
    this.plAirportPanelOpen.set(true);
    this.plAirportHighlight.set(0);
  }

  onPlAirportKeydown(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.plAirportPanelOpen.set(true);
      const max = this.plAirportSuggestions().length - 1;
      this.plAirportHighlight.set(Math.min(this.plAirportHighlight() + 1, Math.max(max, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.plAirportHighlight.set(Math.max(this.plAirportHighlight() - 1, 0));
    } else if (e.key === 'Enter') {
      const suggestions = this.plAirportSuggestions();
      const item = suggestions[this.plAirportHighlight()];
      if (this.plAirportPanelOpen() && item) {
        e.preventDefault();
        this.selectPlAirportSuggestion(item);
      }
    } else if (e.key === 'Escape') {
      this.plAirportPanelOpen.set(false);
    } else if (e.key === 'Backspace' && this.plAirportInput() === '') {
      const next = this.selectedPlAirports().slice(0, -1);
      this.selectedPlAirports.set(next);
      this.load();
    }
  }

  selectPlAirportSuggestion(a: PlAirportSuggestion) {
    this.selectedPlAirports.set([...this.selectedPlAirports(), a]);
    this.plAirportInput.set('');
    this.plAirportHighlight.set(0);
    this.load();
    // Keep focus in the input so the user can keep typing/selecting.
    queueMicrotask(() => this.plAirportInputEl?.nativeElement.focus());
  }

  removePlAirportItem(item: PlAirportSuggestion) {
    this.selectedPlAirports.set(this.selectedPlAirports().filter((a) => a.iata !== item.iata));
    this.load();
  }

  onDestInput(e: Event) {
    this.destInput.set((e.target as HTMLInputElement).value);
    this.destPanelOpen.set(true);
    this.destHighlight.set(0);
  }

  onDestFocus() {
    this.destPanelOpen.set(true);
    this.destHighlight.set(0);
  }

  onDestKeydown(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.destPanelOpen.set(true);
      const max = this.destSuggestions().length - 1;
      this.destHighlight.set(Math.min(this.destHighlight() + 1, Math.max(max, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.destHighlight.set(Math.max(this.destHighlight() - 1, 0));
    } else if (e.key === 'Enter') {
      const suggestions = this.destSuggestions();
      const item = suggestions[this.destHighlight()];
      if (this.destPanelOpen() && item) {
        e.preventDefault();
        this.selectDestSuggestion(item);
      }
    } else if (e.key === 'Escape') {
      this.destPanelOpen.set(false);
    } else if (e.key === 'Backspace' && this.destInput() === '') {
      const next = this.selectedDest().slice(0, -1);
      this.selectedDest.set(next);
      this.load();
    }
  }

  selectDestSuggestion(s: DestSuggestion) {
    this.selectedDest.set([...this.selectedDest(), s]);
    this.destInput.set('');
    this.destHighlight.set(0);
    this.load();
    // Keep focus in the input so the user can keep typing/selecting.
    queueMicrotask(() => this.destInputEl?.nativeElement.focus());
  }

  removeDestItem(item: DestSuggestion) {
    this.selectedDest.set(
      this.selectedDest().filter(
        (s) => !(s.kind === item.kind && s.name === item.name && s.iata === item.iata),
      ),
    );
    this.load();
  }

  toggleDay(js: number) {
    const next = new Set(this.selectedDays());
    if (next.has(js)) next.delete(js);
    else next.add(js);
    this.selectedDays.set(next);
    this.load();
  }

  setDateFrom(e: Event) {
    this.dateFrom.set((e.target as HTMLInputElement).value);
    this.load();
  }

  setDateTo(e: Event) {
    this.dateTo.set((e.target as HTMLInputElement).value);
    this.load();
  }

  setMaxPrice(e: Event) {
    const v = (e.target as HTMLInputElement).value;
    this.maxPrice.set(v ? Number(v) : null);
    this.load();
  }

  setSort(e: Event) {
    this.sort.set((e.target as HTMLSelectElement).value as 'price' | 'date');
    this.load();
  }

  clearFilters() {
    this.selectedPlAirports.set([]);
    this.plAirportInput.set('');
    this.plAirportPanelOpen.set(false);
    this.selectedDest.set([]);
    this.destInput.set('');
    this.destPanelOpen.set(false);
    this.selectedDays.set(new Set());
    this.dateFrom.set('');
    this.dateTo.set('');
    this.maxPrice.set(null);
    this.load();
  }

  private loadMeta() {
    this.oneWayService.getMeta(this.direction()).subscribe((m) => this.meta.set(m));
  }

  private load() {
    this.loading.set(true);
    this.error.set(false);
    this.oneWayService
      .getFares({
        direction: this.direction(),
        plAirport:
          this.selectedPlAirports()
            .map((a) => a.iata)
            .join(',') || undefined,
        country:
          this.selectedDest()
            .filter((s) => s.kind === 'country')
            .map((s) => s.name)
            .join(',') || undefined,
        city:
          this.selectedDest()
            .filter((s) => s.kind === 'city')
            .map((s) => s.name)
            .join(',') || undefined,
        airport:
          this.selectedDest()
            .filter((s) => s.kind === 'airport')
            .map((s) => s.iata)
            .join(',') || undefined,
        dateFrom: this.dateFrom() || undefined,
        dateTo: this.dateTo() || undefined,
        days: [...this.selectedDays()].join(',') || undefined,
        maxPrice: this.maxPrice() ?? undefined,
        sort: this.sort(),
      })
      .subscribe({
        next: (fares) => {
          this.fares.set(fares);
          this.loading.set(false);
        },
        error: () => {
          this.error.set(true);
          this.loading.set(false);
        },
      });
  }

  fmtDate(iso: string): string {
    const d = new Date(iso);
    return `${WD[d.getUTCDay()]} ${d.getUTCDate()} ${MON[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  }

  fmtTime(iso: string): string {
    const d = new Date(iso);
    const hh = String(d.getUTCHours()).padStart(2, '0');
    const mm = String(d.getUTCMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  }

  bookingUrl(f: OneWayFare): string {
    const params = new URLSearchParams({
      adults: '1',
      teens: '0',
      children: '0',
      infants: '0',
      dateOut: f.date.slice(0, 10),
      isReturn: 'false',
      originIata: f.origin,
      destinationIata: f.destination,
    });
    return `https://www.ryanair.com/pl/pl/trip/flights/select?${params}`;
  }
}
