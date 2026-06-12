import {
  Component,
  inject,
  signal,
  computed,
  effect,
  untracked,
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, switchMap } from 'rxjs';
import { DealCardComponent } from './deal-card.component';
import { DealsService, type DealsQueryParams } from '../../core/services/deals.service';
import { SavedDealsService } from '../../core/services/saved-deals.service';
import { AirportsService } from '../../core/services/airports.service';
import { CityImagesService } from '../../core/services/city-images.service';
import type { Deal } from '../../core/models/deal.model';

const ALL_COUNTRIES: { code: string; name: string }[] = [
  { code: 'AL', name: 'Albania' },
  { code: 'BA', name: 'Bośnia' },
  { code: 'BG', name: 'Bułgaria' },
  { code: 'HR', name: 'Chorwacja' },
  { code: 'ME', name: 'Czarnogóra' },
  { code: 'CY', name: 'Cypr' },
  { code: 'FR', name: 'Francja' },
  { code: 'GR', name: 'Grecja' },
  { code: 'ES', name: 'Hiszpania' },
  { code: 'IE', name: 'Irlandia' },
  { code: 'IS', name: 'Islandia' },
  { code: 'IL', name: 'Izrael' },
  { code: 'JO', name: 'Jordania' },
  { code: 'XK', name: 'Kosowo' },
  { code: 'MK', name: 'Macedonia' },
  { code: 'MT', name: 'Malta' },
  { code: 'MA', name: 'Maroko' },
  { code: 'IT', name: 'Włochy' },
  { code: 'PT', name: 'Portugalia' },
  { code: 'RO', name: 'Rumunia' },
  { code: 'RS', name: 'Serbia' },
  { code: 'TN', name: 'Tunezja' },
  { code: 'TR', name: 'Turcja' },
  { code: 'GB', name: 'Wielka Brytania' },
].sort((a, b) => a.name.localeCompare(b.name, 'pl'));

const TRIP_LEVELS = [
  { id: 1, label: 'Tam i z powrotem' },
  { id: 2, label: 'Bliskie lotniska (WAW↔WMI, KRK↔KTW)' },
  { id: 3, label: 'Open-jaw (różne lotniska)' },
];

const DEFAULT_MAX_PRICE = 800;
const MAX_NIGHTS = 14;

const DAYS = [
  { js: 1, label: 'Pn' },
  { js: 2, label: 'Wt' },
  { js: 3, label: 'Śr' },
  { js: 4, label: 'Cz' },
  { js: 5, label: 'Pt' },
  { js: 6, label: 'Sb' },
  { js: 0, label: 'Nd' },
];

const TIMES = [
  { id: 'morning', label: 'Rano', sub: '6–12' },
  { id: 'afternoon', label: 'Popoł.', sub: '12–18' },
  { id: 'evening', label: 'Wiecz.', sub: '18–24' },
];

@Component({
  selector: 'app-deals-page',
  standalone: true,
  imports: [CommonModule, RouterLink, DealCardComponent],
  template: `
    <!-- ── Header ──────────────────────────── -->
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
          <button class="nav-item active">Okazje</button>
          <button class="nav-item" disabled>Wyszukiwarka</button>
          <button class="nav-item" disabled>Alerty</button>
        </nav>
        <div class="header-right">
          <a [routerLink]="['/deals/saved']" class="saved-link">
            Zapisane
            @if (savedCount() > 0) {
              <span class="saved-badge">{{ savedCount() }}</span>
            }
          </a>
        </div>
      </div>
    </header>

    <!-- ── Page ─────────────────────────────── -->
    <main class="page">
      <div class="page-head">
        <h1>Okazje weekendowe</h1>
        <p>
          Tanie loty z polskich lotnisk · 3–7 dni
          @if (lastUpdate()) {
            <span class="muted"> · Odświeżono: {{ lastUpdate() }}</span>
          }
        </p>
      </div>

      <!-- ── Filter bar ────────────────────── -->
      <div class="filter-card">
        <!-- Row 1: dropdowns -->
        <div class="filter-row">
          <!-- Kraj -->
          <div class="fg" (click)="$event.stopPropagation()">
            <span class="fg-label">Kraj</span>
            <button
              class="dd-btn"
              [class.dd-active]="selectedCountries().length > 0"
              (click)="cOpen.set(!cOpen())"
            >
              <span>{{
                selectedCountries().length ? selectedCountries().length + ' krajów' : 'Wszystkie'
              }}</span>
              <svg class="chevron" [class.flip]="cOpen()" width="10" height="6" viewBox="0 0 10 6">
                <path
                  d="M1 1l4 4 4-4"
                  stroke="currentColor"
                  stroke-width="1.5"
                  fill="none"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </button>
            @if (cOpen()) {
              <div class="dd-menu">
                @for (c of ALL_COUNTRIES; track c.code) {
                  <label class="dd-item">
                    <input
                      type="checkbox"
                      [checked]="selectedCountries().includes(c.code)"
                      (change)="toggleCountry(c.code)"
                    />
                    {{ c.name }}
                  </label>
                }
              </div>
            }
          </div>

          <!-- Lotnisko wylotu -->
          <div class="fg" (click)="$event.stopPropagation()">
            <span class="fg-label">Lotnisko wylotu</span>
            <button
              class="dd-btn"
              [class.dd-active]="selectedOrigins().length > 0"
              (click)="oOpen.set(!oOpen())"
            >
              <span>{{
                selectedOrigins().length ? selectedOrigins().join(', ') : 'Wszystkie lotniska'
              }}</span>
              <svg class="chevron" [class.flip]="oOpen()" width="10" height="6" viewBox="0 0 10 6">
                <path
                  d="M1 1l4 4 4-4"
                  stroke="currentColor"
                  stroke-width="1.5"
                  fill="none"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </button>
            @if (oOpen()) {
              <div class="dd-menu">
                @for (ap of polishAirports(); track ap.iata) {
                  <label class="dd-item">
                    <input
                      type="checkbox"
                      [checked]="selectedOrigins().includes(ap.iata)"
                      (change)="toggleOrigin(ap.iata)"
                    />
                    {{ ap.name }} ({{ ap.iata }})
                  </label>
                }
              </div>
            }
          </div>

          <!-- Typ połączenia -->
          <div class="fg" (click)="$event.stopPropagation()">
            <span class="fg-label">Typ połączenia</span>
            <button
              class="dd-btn"
              [class.dd-active]="!(selectedLevels().length === 1 && selectedLevels()[0] === 1)"
              (click)="tOpen.set(!tOpen())"
            >
              <span>{{
                selectedLevels().length === 1 && selectedLevels()[0] === 1
                  ? 'Tam i z powrotem'
                  : selectedLevels().length === 3
                    ? 'Wszystkie typy'
                    : selectedLevels().length + ' wybrane'
              }}</span>
              <svg class="chevron" [class.flip]="tOpen()" width="10" height="6" viewBox="0 0 10 6">
                <path
                  d="M1 1l4 4 4-4"
                  stroke="currentColor"
                  stroke-width="1.5"
                  fill="none"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </button>
            @if (tOpen()) {
              <div class="dd-menu">
                @for (t of TRIP_LEVELS; track t.id) {
                  <label class="dd-item">
                    <input
                      type="checkbox"
                      [checked]="selectedLevels().includes(t.id)"
                      (change)="toggleLevel(t.id)"
                    />
                    {{ t.label }}
                  </label>
                }
              </div>
            }
          </div>

          <!-- Sortuj -->
          <div class="fg">
            <span class="fg-label">Sortuj</span>
            <div class="sel-wrap">
              <select (change)="onSortChange($event)">
                <option value="price" [selected]="sortBy() === 'price'">Cena rosnąco</option>
                <option value="departure" [selected]="sortBy() === 'departure'">Data wylotu</option>
                <option value="duration" [selected]="sortBy() === 'duration'">Liczba nocy</option>
              </select>
            </div>
          </div>

          @if (activeFilterCount() > 0) {
            <button class="clear-btn" (click)="clearFilters()">
              Wyczyść ({{ activeFilterCount() }})
            </button>
          }
        </div>

        <!-- Row 2: sliders -->
        <div class="filter-row filter-row--sliders">
          <div class="fg fg--slider">
            <div class="slider-header">
              <span class="fg-label">Maks. cena</span>
              <span class="slider-val">{{ maxPrice() }} PLN</span>
            </div>
            <input
              class="range"
              type="range"
              min="200"
              [max]="DEFAULT_MAX_PRICE"
              step="50"
              [value]="maxPrice()"
              (input)="maxPrice.set(+readNum($event))"
            />
            <div class="range-ends">
              <span>200</span><span>{{ DEFAULT_MAX_PRICE }}</span>
            </div>
          </div>

          <div class="fg fg--nights">
            <span class="fg-label">Liczba nocy</span>
            <div class="nights-inputs">
              <span class="nights-sub">od</span>
              <input
                class="nights-num"
                type="number"
                min="1"
                [max]="MAX_NIGHTS"
                [value]="minNights()"
                (change)="onMinNights($event)"
              />
              <span class="nights-sub">do</span>
              <input
                class="nights-num"
                type="number"
                min="1"
                [max]="MAX_NIGHTS"
                [value]="maxNights()"
                (change)="onMaxNights($event)"
              />
            </div>
          </div>
        </div>

        <!-- Row 3: days & times -->
        <div class="filter-row filter-row--days">
          <div class="dt-group">
            <span class="dt-label">Wylot</span>
            <div class="dt-pills">
              @for (d of DAYS; track d.js) {
                <button
                  class="pill"
                  [class.pill--on]="depDays().includes(d.js)"
                  (click)="toggleDay(depDays, d.js)"
                >
                  {{ d.label }}
                </button>
              }
              <span class="dt-sep"></span>
              @for (t of TIMES; track t.id) {
                <button
                  class="pill pill--time"
                  [class.pill--on]="depTimes().includes(t.id)"
                  (click)="toggleTime(depTimes, t.id)"
                >
                  {{ t.label }}<span class="pill-sub">{{ t.sub }}</span>
                </button>
              }
            </div>
          </div>
          <div class="dt-group">
            <span class="dt-label">Powrót</span>
            <div class="dt-pills">
              @for (d of DAYS; track d.js) {
                <button
                  class="pill"
                  [class.pill--on]="retDays().includes(d.js)"
                  (click)="toggleDay(retDays, d.js)"
                >
                  {{ d.label }}
                </button>
              }
              <span class="dt-sep"></span>
              @for (t of TIMES; track t.id) {
                <button
                  class="pill pill--time"
                  [class.pill--on]="retTimes().includes(t.id)"
                  (click)="toggleTime(retTimes, t.id)"
                >
                  {{ t.label }}<span class="pill-sub">{{ t.sub }}</span>
                </button>
              }
            </div>
          </div>
        </div>
      </div>

      <!-- ── Results ───────────────────────── -->
      @if (loading()) {
        <div class="state-row">
          <div class="spinner"></div>
          <span>Wczytywanie ofert…</span>
        </div>
      } @else if (error()) {
        <div class="state-row state-row--error">
          Nie udało się wczytać ofert. Spróbuj odświeżyć stronę.
        </div>
      } @else {
        <div class="results-card">
          <div class="results-toolbar">
            <span class="results-count"
              >{{ allDeals().length }} {{ pluralize(allDeals().length) }}</span
            >
          </div>

          @if (allDeals().length === 0) {
            <div class="empty">
              <div class="empty-icon">✈</div>
              <div class="empty-title">Brak okazji dla tych filtrów</div>
              <div class="empty-sub">Zmień kraj, lotnisko lub budżet</div>
              <button class="btn-sec" (click)="clearFilters()">Wyczyść filtry</button>
            </div>
          } @else {
            @for (deal of visibleDeals(); track deal.id) {
              <app-deal-card
                [deal]="deal"
                [selected]="selectedId() === deal.id"
                (select)="selectedId.set($event)"
              />
            }
            @if (visibleDeals().length < allDeals().length) {
              <div class="load-more">
                <button class="btn-sec" (click)="loadMore()">
                  Pokaż więcej ({{ allDeals().length - visibleDeals().length }} pozostałych)
                </button>
              </div>
            }
          }
        </div>
      }

      <p class="footer-note">
        Ceny w obie strony za osobę · Dostępność może się zmienić · „Sprawdź" prowadzi do aktualnej
        oferty na stronie linii lotniczej
      </p>
    </main>
  `,
  styles: [
    `
      /* ── Header ─────────────────────────────── */
      .site-header {
        position: sticky;
        top: 0;
        z-index: 300;
        height: var(--header-h);
        background: var(--color-surface);
        border-bottom: 1px solid var(--color-border);
      }
      .header-inner {
        max-width: 1100px;
        margin: 0 auto;
        padding: 0 24px;
        height: 100%;
        display: flex;
        align-items: center;
        gap: 20px;
      }
      .logo-link {
        display: flex;
        align-items: center;
        text-decoration: none;
        flex-shrink: 0;
      }

      .main-nav {
        display: flex;
        gap: 2px;
        margin-left: 4px;
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
        transition: all 0.12s;
      }
      .nav-item.active {
        font-weight: 600;
        color: var(--color-blue-700);
        background: var(--color-blue-50);
      }
      .nav-item:disabled {
        opacity: 0.4;
        cursor: default;
      }

      .header-right {
        margin-left: auto;
      }
      .saved-link {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 5px 12px;
        border-radius: var(--radius-md);
        font-size: 14px;
        font-weight: 500;
        color: var(--color-text-secondary);
        text-decoration: none;
        transition: background 0.12s;
      }
      .saved-link:hover {
        background: var(--color-sidebar-active);
      }
      .saved-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 18px;
        height: 18px;
        padding: 0 4px;
        border-radius: 9px;
        background: var(--color-blue-700);
        color: #fff;
        font-size: 11px;
        font-weight: 700;
      }

      /* ── Page ────────────────────────────────── */
      .page {
        max-width: 1100px;
        margin: 0 auto;
        padding: 28px 24px 56px;
        display: flex;
        flex-direction: column;
        gap: 20px;
      }
      .page-head h1 {
        font-size: 26px;
        font-weight: 800;
        letter-spacing: -0.025em;
        margin-bottom: 4px;
      }
      .page-head p {
        font-size: 14px;
        color: var(--color-text-secondary);
      }
      .muted {
        color: var(--color-text-tertiary);
      }

      /* ── Filter card ──────────────────────────── */
      .filter-card {
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-sm);
        overflow: visible;
      }

      .filter-row {
        display: flex;
        gap: 0;
        align-items: stretch;
        flex-wrap: wrap;
        border-bottom: 1px solid var(--color-border);
      }
      .filter-row:last-child {
        border-bottom: none;
      }
      .filter-row--sliders {
        padding: 12px 16px;
        gap: 24px;
        border-bottom: none;
      }

      /* Filter group */
      .fg {
        position: relative;
        flex: 1;
        min-width: 130px;
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 12px 16px;
        border-right: 1px solid var(--color-border);
      }
      .fg:last-child {
        border-right: none;
      }
      .fg--slider {
        border-right: none;
        max-width: 280px;
      }

      .fg-label {
        font-size: 10px;
        font-weight: 600;
        color: var(--color-text-tertiary);
        text-transform: uppercase;
        letter-spacing: 0.07em;
      }

      /* Dropdown button */
      .dd-btn {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding: 6px 10px;
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        font-size: 13px;
        font-weight: 500;
        color: var(--color-text-primary);
        cursor: pointer;
        text-align: left;
        transition:
          border-color 0.15s,
          box-shadow 0.15s;
      }
      .dd-btn:hover {
        border-color: var(--color-border-strong);
      }
      .dd-btn:focus {
        outline: none;
        border-color: var(--color-blue-700);
        box-shadow: var(--shadow-focus);
      }
      .dd-btn.dd-active {
        border-color: var(--color-blue-600);
        background: var(--color-blue-50);
        color: var(--color-blue-800);
      }
      .chevron {
        flex-shrink: 0;
        color: var(--color-text-tertiary);
        transition: transform 0.15s;
      }
      .chevron.flip {
        transform: rotate(180deg);
      }

      /* Dropdown menu */
      .dd-menu {
        position: absolute;
        top: calc(100% + 4px);
        left: 0;
        z-index: 400;
        min-width: 220px;
        max-height: 260px;
        overflow-y: auto;
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-lg);
        box-shadow: 0 6px 16px rgba(0, 0, 0, 0.1);
        padding: 6px 0;
      }
      .dd-item {
        display: flex;
        align-items: center;
        gap: 9px;
        padding: 8px 14px;
        font-size: 13px;
        color: var(--color-text-primary);
        cursor: pointer;
        transition: background 0.1s;
        border-bottom: 1px solid var(--color-border);
      }
      .dd-item:last-child {
        border-bottom: none;
      }
      .dd-item:hover {
        background: var(--color-sidebar-active);
      }
      .dd-item input[type='checkbox'] {
        accent-color: var(--color-blue-700);
        width: 14px;
        height: 14px;
        flex-shrink: 0;
        cursor: pointer;
      }

      /* Native select */
      .sel-wrap select {
        width: 100%;
        padding: 6px 30px 6px 10px;
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        font-size: 13px;
        font-weight: 500;
        color: var(--color-text-primary);
        background: var(--color-surface);
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%239ca3af' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
        background-repeat: no-repeat;
        background-position: right 10px center;
        cursor: pointer;
        outline: none;
        transition:
          border-color 0.15s,
          box-shadow 0.15s;
      }
      .sel-wrap select:focus {
        border-color: var(--color-blue-700);
        box-shadow: var(--shadow-focus);
      }

      /* Clear button (inline in filter-row) */
      .clear-btn {
        align-self: center;
        margin: 0 16px 0 0;
        padding: 6px 14px;
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        font-size: 12px;
        font-weight: 500;
        color: var(--color-text-secondary);
        background: var(--color-surface);
        cursor: pointer;
        white-space: nowrap;
        transition: background 0.12s;
      }
      .clear-btn:hover {
        background: var(--color-sidebar-active);
      }

      /* Sliders */
      .slider-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .slider-val {
        font-size: 13px;
        font-weight: 700;
        color: var(--color-text-primary);
      }
      .range-pair {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .fg--nights {
        border-right: none;
        min-width: 0;
        flex: 0 0 auto;
      }
      .nights-inputs {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-top: 2px;
      }
      .nights-sub {
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--color-text-tertiary);
      }
      .nights-num {
        width: 48px;
        padding: 5px 6px;
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        font-size: 13px;
        font-weight: 600;
        color: var(--color-text-primary);
        background: var(--color-surface);
        text-align: center;
        outline: none;
        font-variant-numeric: tabular-nums;
      }
      .nights-num:focus {
        border-color: var(--color-blue-700);
        box-shadow: var(--shadow-focus);
      }
      .range {
        -webkit-appearance: none;
        appearance: none;
        width: 100%;
        height: 4px;
        background: var(--color-border);
        border-radius: 2px;
        outline: none;
        cursor: pointer;
      }
      .range::-webkit-slider-thumb {
        -webkit-appearance: none;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: var(--color-blue-700);
        border: 2px solid #fff;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
        cursor: pointer;
        transition: background 0.12s;
      }
      .range::-webkit-slider-thumb:hover {
        background: var(--color-blue-800);
      }
      .range::-moz-range-thumb {
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: var(--color-blue-700);
        border: 2px solid #fff;
        cursor: pointer;
      }
      .range-ends {
        display: flex;
        justify-content: space-between;
        font-size: 10px;
        color: var(--color-text-tertiary);
      }

      /* ── Days & times row ───────────────────────── */
      .filter-row--days {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 12px 16px;
        border-bottom: none;
      }
      .dt-group {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .dt-label {
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.07em;
        color: var(--color-text-tertiary);
        min-width: 42px;
      }
      .dt-pills {
        display: flex;
        align-items: center;
        gap: 4px;
        flex-wrap: wrap;
      }
      .dt-sep {
        display: inline-block;
        width: 1px;
        height: 20px;
        background: var(--color-border);
        margin: 0 4px;
      }
      .pill {
        padding: 3px 8px;
        border-radius: var(--radius-full);
        border: 1px solid var(--color-border);
        background: var(--color-surface);
        font-size: 12px;
        font-weight: 500;
        color: var(--color-text-secondary);
        cursor: pointer;
        transition: all 0.12s;
        line-height: 1.4;
        white-space: nowrap;
      }
      .pill:hover {
        border-color: var(--color-border-strong);
        color: var(--color-text-primary);
      }
      .pill--on {
        background: var(--color-blue-50);
        border-color: var(--color-blue-600);
        color: var(--color-blue-800);
        font-weight: 600;
      }
      .pill--time {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 2px 10px;
      }
      .pill-sub {
        font-size: 9px;
        font-weight: 400;
        opacity: 0.7;
        line-height: 1.2;
      }

      /* ── State rows ──────────────────────────── */
      .state-row {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 40px 0;
        font-size: 14px;
        color: var(--color-text-secondary);
      }
      .state-row--error {
        padding: 20px 24px;
        color: #dc2626;
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-lg);
      }
      .spinner {
        width: 22px;
        height: 22px;
        flex-shrink: 0;
        border: 2px solid var(--color-border);
        border-top-color: var(--color-blue-700);
        border-radius: 50%;
        animation: spin 0.7s linear infinite;
      }
      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }

      /* ── Results card ────────────────────────── */
      .results-card {
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-lg);
        overflow: hidden;
        box-shadow: var(--shadow-sm);
      }
      .results-toolbar {
        display: flex;
        align-items: center;
        padding: 10px 20px;
        border-bottom: 1px solid var(--color-border);
      }
      .results-count {
        font-size: 13px;
        font-weight: 500;
        color: var(--color-text-secondary);
      }

      /* Empty state */
      .empty {
        padding: 60px 20px;
        text-align: center;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
      }
      .empty-icon {
        font-size: 36px;
        color: var(--color-text-tertiary);
      }
      .empty-title {
        font-size: 15px;
        font-weight: 600;
        color: var(--color-text-secondary);
      }
      .empty-sub {
        font-size: 13px;
        color: var(--color-text-tertiary);
      }

      /* Load more */
      .load-more {
        display: flex;
        justify-content: center;
        padding: 16px;
        border-top: 1px solid var(--color-border);
      }

      /* Shared secondary button */
      .btn-sec {
        padding: 7px 14px;
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        font-size: 13px;
        font-weight: 500;
        color: var(--color-text-primary);
        background: var(--color-surface);
        cursor: pointer;
        transition: background 0.12s;
      }
      .btn-sec:hover {
        background: var(--color-sidebar-active);
      }

      /* Footer */
      .footer-note {
        font-size: 12px;
        color: var(--color-text-tertiary);
        text-align: center;
      }

      @media (max-width: 600px) {
        .header-inner {
          padding: 0 14px;
          gap: 10px;
        }
        .main-nav {
          display: none;
        }
        .page {
          padding: 16px 0 40px;
          gap: 14px;
        }
        .page-head {
          padding: 0 14px;
        }
        .page-head h1 {
          font-size: 20px;
        }
        .filter-card {
          border-radius: 0;
          border-left: none;
          border-right: none;
        }
        .filter-row {
          overflow-x: auto;
          flex-wrap: nowrap;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
        }
        .filter-row::-webkit-scrollbar {
          display: none;
        }
        .filter-row--days {
          overflow-x: visible;
          flex-wrap: nowrap;
          padding: 10px 14px;
          gap: 6px;
        }
        .filter-row--sliders {
          padding: 10px 14px;
          gap: 16px;
        }
        .fg {
          min-width: 100px;
          padding: 10px 12px;
        }
        .dd-btn span {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 90px;
        }
        .dt-group {
          flex-wrap: nowrap;
          overflow-x: auto;
          scrollbar-width: none;
          gap: 6px;
        }
        .dt-group::-webkit-scrollbar {
          display: none;
        }
        .dt-pills {
          flex-wrap: nowrap;
        }
        .results-header {
          padding: 0 14px;
        }
        .deal-list {
          border-radius: 0;
          border-left: none;
          border-right: none;
        }
      }
    `,
  ],
})
export class DealsPageComponent {
  private dealsService = inject(DealsService);
  private savedService = inject(SavedDealsService);
  private airportsSvc = inject(AirportsService);
  cityImages = inject(CityImagesService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  readonly DEFAULT_MAX_PRICE = DEFAULT_MAX_PRICE;
  readonly MAX_NIGHTS = MAX_NIGHTS;
  readonly ALL_COUNTRIES = ALL_COUNTRIES;
  readonly DAYS = DAYS;
  readonly TIMES = TIMES;
  polishAirports = this.airportsSvc.polishAirports;
  readonly TRIP_LEVELS = TRIP_LEVELS;

  loading = signal(true);
  error = signal(false);
  allDeals = signal<Deal[]>([]);
  lastUpdate = signal<string | null>(null);

  selectedCountries = signal<string[]>([]);
  selectedOrigins = signal<string[]>([]);
  maxPrice = signal(DEFAULT_MAX_PRICE);
  sortBy = signal<'price' | 'departure' | 'duration'>('price');
  selectedLevels = signal<number[]>([1]);
  minNights = signal(1);
  maxNights = signal(MAX_NIGHTS);
  depDays = signal<number[]>([]);
  retDays = signal<number[]>([]);
  depTimes = signal<string[]>([]);
  retTimes = signal<string[]>([]);
  visibleCount = signal(24);
  selectedId = signal<string | null>(null);

  // dropdown open state
  cOpen = signal(false);
  oOpen = signal(false);
  tOpen = signal(false);

  savedCount = computed(() => this.savedService.savedDeals().length);

  visibleDeals = computed(() => this.allDeals().slice(0, this.visibleCount()));

  activeFilterCount = computed(() => {
    let n = 0;
    if (this.selectedCountries().length > 0) n++;
    if (this.selectedOrigins().length > 0) n++;
    if (this.maxPrice() < DEFAULT_MAX_PRICE) n++;
    if (!(this.selectedLevels().length === 1 && this.selectedLevels()[0] === 1)) n++;
    if (this.minNights() > 1 || this.maxNights() < MAX_NIGHTS) n++;
    if (this.depDays().length > 0) n++;
    if (this.retDays().length > 0) n++;
    if (this.depTimes().length > 0) n++;
    if (this.retTimes().length > 0) n++;
    return n;
  });

  private query = computed<DealsQueryParams>(() => ({
    destCountry: this.selectedCountries().join(',') || undefined,
    maxPrice: this.maxPrice() < DEFAULT_MAX_PRICE ? this.maxPrice() : undefined,
    origin: this.selectedOrigins().join(',') || undefined,
    sort: this.sortBy(),
    levels:
      this.selectedLevels().length < 3 ? [...this.selectedLevels()].sort().join(',') : undefined,
    minNights: this.minNights() > 1 ? this.minNights() : undefined,
    maxNights: this.maxNights() < MAX_NIGHTS ? this.maxNights() : undefined,
    depDays: this.depDays().length ? this.depDays().join(',') : undefined,
    retDays: this.retDays().length ? this.retDays().join(',') : undefined,
    depTimes: this.depTimes().length ? this.depTimes().join(',') : undefined,
    retTimes: this.retTimes().length ? this.retTimes().join(',') : undefined,
  }));

  @HostListener('document:click')
  closeAllMenus() {
    this.cOpen.set(false);
    this.oOpen.set(false);
    this.tOpen.set(false);
  }

  constructor() {
    const p = this.route.snapshot.queryParams;
    if (p['countries']) this.selectedCountries.set(p['countries'].split(','));
    if (p['origins']) this.selectedOrigins.set(p['origins'].split(','));
    if (p['maxPrice']) this.maxPrice.set(Number(p['maxPrice']));
    if (p['sort']) this.sortBy.set(p['sort']);
    if (p['levels']) this.selectedLevels.set(p['levels'].split(',').map(Number));
    if (p['minNights']) this.minNights.set(Number(p['minNights']));
    if (p['maxNights']) this.maxNights.set(Number(p['maxNights']));

    const search$ = new Subject<DealsQueryParams>();
    search$
      .pipe(
        switchMap((q) => {
          this.loading.set(true);
          this.error.set(false);
          this.visibleCount.set(24);
          return this.dealsService.getDeals(q);
        }),
        takeUntilDestroyed(),
      )
      .subscribe({
        next: (d) => {
          this.allDeals.set(d);
          this.loading.set(false);
        },
        error: () => {
          this.error.set(true);
          this.loading.set(false);
        },
      });

    effect(() => search$.next(this.query()));

    effect(() => {
      const deals = this.allDeals();
      const nameMap = this.airportsSvc.nameMap();
      if (deals.length === 0 || nameMap.size === 0) return;
      const cities = [...new Set(deals.map((d) => this.airportsSvc.cityName(d.destAirport)))];
      untracked(() => this.cityImages.fetchBatch(cities));
    });

    effect(() => {
      const c = this.selectedCountries(),
        o = this.selectedOrigins();
      const p = this.maxPrice(),
        s = this.sortBy(),
        l = this.selectedLevels();
      this.router.navigate([], {
        relativeTo: this.route,
        replaceUrl: true,
        queryParams: {
          countries: c.length ? c.join(',') : null,
          origins: o.length ? o.join(',') : null,
          maxPrice: p < DEFAULT_MAX_PRICE ? p : null,
          sort: s !== 'price' ? s : null,
          levels: !(l.length === 1 && l[0] === 1) ? [...l].sort().join(',') : null,
          minNights: this.minNights() > 1 ? this.minNights() : null,
          maxNights: this.maxNights() < MAX_NIGHTS ? this.maxNights() : null,
          depDays: this.depDays().length ? this.depDays().join(',') : null,
          retDays: this.retDays().length ? this.retDays().join(',') : null,
          depTimes: this.depTimes().length ? this.depTimes().join(',') : null,
          retTimes: this.retTimes().length ? this.retTimes().join(',') : null,
        },
      });
    });

    this.dealsService.getHealth().subscribe({
      next: (h) => {
        if (h.lastSuccessfulRun) {
          const mins = Math.round((Date.now() - new Date(h.lastSuccessfulRun).getTime()) / 60000);
          this.lastUpdate.set(mins < 60 ? `${mins} min temu` : `${Math.round(mins / 60)} h temu`);
        }
      },
      error: () => {},
    });
  }

  toggleCountry(code: string) {
    const c = this.selectedCountries();
    this.selectedCountries.set(c.includes(code) ? c.filter((x) => x !== code) : [...c, code]);
  }
  toggleOrigin(code: string) {
    const c = this.selectedOrigins();
    this.selectedOrigins.set(c.includes(code) ? c.filter((x) => x !== code) : [...c, code]);
  }
  toggleLevel(id: number) {
    const c = this.selectedLevels();
    this.selectedLevels.set(c.includes(id) ? c.filter((x) => x !== id) : [...c, id]);
  }

  toggleDay(sig: typeof this.depDays, js: number) {
    const c = sig();
    sig.set(c.includes(js) ? c.filter((x) => x !== js) : [...c, js]);
  }

  toggleTime(sig: typeof this.depTimes, id: string) {
    const c = sig();
    sig.set(c.includes(id) ? c.filter((x) => x !== id) : [...c, id]);
  }

  onMinNights(e: Event) {
    const v = this.readNum(e);
    this.minNights.set(Math.min(v, this.maxNights()));
  }
  onMaxNights(e: Event) {
    const v = this.readNum(e);
    this.maxNights.set(Math.max(v, this.minNights()));
  }

  onSortChange(e: Event) {
    this.sortBy.set((e.target as HTMLSelectElement).value as 'price' | 'departure' | 'duration');
  }

  clearFilters() {
    this.selectedCountries.set([]);
    this.selectedOrigins.set([]);
    this.maxPrice.set(DEFAULT_MAX_PRICE);
    this.sortBy.set('price');
    this.selectedLevels.set([1]);
    this.minNights.set(1);
    this.maxNights.set(MAX_NIGHTS);
    this.depDays.set([]);
    this.retDays.set([]);
    this.depTimes.set([]);
    this.retTimes.set([]);
    this.visibleCount.set(24);
  }

  loadMore() {
    this.visibleCount.update((n) => n + 24);
  }

  readNum(e: Event): number {
    return +(e.target as HTMLInputElement).value;
  }

  pluralize(n: number): string {
    if (n === 1) return 'okazja';
    if (n >= 2 && n <= 4) return 'okazje';
    return 'okazji';
  }
}
