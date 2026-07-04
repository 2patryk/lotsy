import { Component, inject, signal, computed, HostListener } from '@angular/core';
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

      <!-- ── Filters ─────────────────────────── -->
      <div class="filter-card">
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

          <!-- PL airport -->
          <div class="fg" (click)="$event.stopPropagation()">
            <span class="fg-label">Lotnisko polskie</span>
            <button
              class="dd-btn"
              [class.dd-active]="selectedAirports().size > 0"
              (click)="toggleDropdown('airport')"
            >
              <span>{{ airportLabel() }}</span>
              <svg
                class="chevron"
                [class.flip]="openDropdown() === 'airport'"
                width="10"
                height="6"
                viewBox="0 0 10 6"
              >
                <path d="M1 1l4 4 4-4" stroke="currentColor" stroke-width="1.5" fill="none" />
              </svg>
            </button>
            @if (openDropdown() === 'airport') {
              <div class="dd-panel">
                @for (a of meta().plAirports; track a.iata) {
                  <label class="dd-opt">
                    <input
                      type="checkbox"
                      [checked]="selectedAirports().has(a.iata)"
                      (change)="toggleAirport(a.iata)"
                    />
                    {{ a.city }} <span class="dd-code">({{ a.iata }})</span>
                  </label>
                }
              </div>
            }
          </div>

          <!-- Country -->
          <div class="fg" (click)="$event.stopPropagation()">
            <span class="fg-label">Kraj</span>
            <button
              class="dd-btn"
              [class.dd-active]="selectedCountries().size > 0"
              (click)="toggleDropdown('country')"
            >
              <span>{{ countryLabel() }}</span>
              <svg
                class="chevron"
                [class.flip]="openDropdown() === 'country'"
                width="10"
                height="6"
                viewBox="0 0 10 6"
              >
                <path d="M1 1l4 4 4-4" stroke="currentColor" stroke-width="1.5" fill="none" />
              </svg>
            </button>
            @if (openDropdown() === 'country') {
              <div class="dd-panel">
                @for (c of meta().countries; track c) {
                  <label class="dd-opt">
                    <input
                      type="checkbox"
                      [checked]="selectedCountries().has(c)"
                      (change)="toggleCountry(c)"
                    />
                    {{ c }}
                  </label>
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
                  <span class="dest-country">{{ f.destCountry }}</span>
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

      @media (max-width: 640px) {
        .offer-row {
          grid-template-columns: 1fr;
          gap: 10px;
        }
        .offer-right {
          flex-direction: row;
          align-items: center;
          justify-content: space-between;
          width: 100%;
        }
        .price-block {
          text-align: left;
        }
      }
    `,
  ],
})
export class OneWayPageComponent {
  private oneWayService = inject(OneWayService);

  readonly DAYS = DAYS;

  direction = signal<OneWayDirection>('OUT');
  loading = signal(true);
  error = signal(false);
  fares = signal<OneWayFare[]>([]);
  meta = signal<OneWayMeta>({
    plAirports: [],
    countries: [],
    dateMin: null,
    dateMax: null,
    lastUpdated: null,
  });

  openDropdown = signal<'airport' | 'country' | null>(null);
  selectedAirports = signal<Set<string>>(new Set());
  selectedCountries = signal<Set<string>>(new Set());
  selectedDays = signal<Set<number>>(new Set());
  dateFrom = signal<string>('');
  dateTo = signal<string>('');
  maxPrice = signal<number | null>(null);
  sort = signal<'price' | 'date'>('price');

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

  airportLabel = computed(() => {
    const n = this.selectedAirports().size;
    return n === 0 ? 'Wszystkie' : n === 1 ? [...this.selectedAirports()][0] : `${n} lotnisk`;
  });
  countryLabel = computed(() => {
    const sel = this.selectedCountries();
    return sel.size === 0 ? 'Wszystkie' : sel.size === 1 ? [...sel][0] : `${sel.size} krajów`;
  });
  hasFilters = computed(
    () =>
      this.selectedAirports().size > 0 ||
      this.selectedCountries().size > 0 ||
      this.selectedDays().size > 0 ||
      !!this.dateFrom() ||
      !!this.dateTo() ||
      this.maxPrice() != null,
  );

  constructor() {
    this.loadMeta();
    this.load();
  }

  @HostListener('document:click')
  closeDropdowns() {
    this.openDropdown.set(null);
  }

  toggleDropdown(which: 'airport' | 'country') {
    this.openDropdown.set(this.openDropdown() === which ? null : which);
  }

  setDirection(direction: OneWayDirection) {
    if (this.direction() === direction) return;
    this.direction.set(direction);
    // Filters depend on direction-specific meta (airports/countries/date range).
    this.selectedAirports.set(new Set());
    this.selectedCountries.set(new Set());
    this.selectedDays.set(new Set());
    this.dateFrom.set('');
    this.dateTo.set('');
    this.maxPrice.set(null);
    this.loadMeta();
    this.load();
  }

  toggleAirport(iata: string) {
    const next = new Set(this.selectedAirports());
    if (next.has(iata)) next.delete(iata);
    else next.add(iata);
    this.selectedAirports.set(next);
    this.load();
  }

  toggleCountry(country: string) {
    const next = new Set(this.selectedCountries());
    if (next.has(country)) next.delete(country);
    else next.add(country);
    this.selectedCountries.set(next);
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
    this.selectedAirports.set(new Set());
    this.selectedCountries.set(new Set());
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
        plAirport: [...this.selectedAirports()].join(',') || undefined,
        country: [...this.selectedCountries()].join(',') || undefined,
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
