import { Component, input, output, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { Deal } from '../../core/models/deal.model';
import { SavedDealsService } from '../../core/services/saved-deals.service';
import { AirportsService } from '../../core/services/airports.service';
import { CityImagesService } from '../../core/services/city-images.service';

const COUNTRY_NAMES: Record<string, string> = {
  IT: 'Włochy',
  ES: 'Hiszpania',
  GR: 'Grecja',
  HR: 'Chorwacja',
  PT: 'Portugalia',
  MT: 'Malta',
  CY: 'Cypr',
  TR: 'Turcja',
  BG: 'Bułgaria',
  FR: 'Francja',
  AL: 'Albania',
  ME: 'Czarnogóra',
  MA: 'Maroko',
  IL: 'Izrael',
  TN: 'Tunezja',
  RS: 'Serbia',
  RO: 'Rumunia',
  BA: 'Bośnia',
  MK: 'Macedonia',
  XK: 'Kosowo',
  GB: 'W. Brytania',
  IE: 'Irlandia',
  IS: 'Islandia',
  JO: 'Jordania',
};

const WD = ['ndz', 'pon', 'wt', 'śr', 'czw', 'pt', 'sob'];
const MON = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'];

const WEEK = [
  { js: 1, label: 'Pn' },
  { js: 2, label: 'Wt' },
  { js: 3, label: 'Śr' },
  { js: 4, label: 'Cz' },
  { js: 5, label: 'Pt' },
  { js: 6, label: 'Sb' },
  { js: 0, label: 'Nd' },
];

function activeDays(departAt: string, returnAt: string): Set<number> {
  const active = new Set<number>();
  const cur = new Date(departAt);
  cur.setUTCHours(0, 0, 0, 0);
  const end = new Date(returnAt);
  end.setUTCHours(23, 59, 59, 0);
  while (cur <= end) {
    active.add(cur.getUTCDay());
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return active;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${WD[d.getUTCDay()]} ${d.getUTCDate()} ${MON[d.getUTCMonth()]}`;
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCHours().toString().padStart(2, '0')}:${d.getUTCMinutes().toString().padStart(2, '0')}`;
}

@Component({
  selector: 'app-deal-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="deal-row"
      [class.selected]="selected()"
      [style.--thumb]="thumbUrl() ? 'url(' + thumbUrl() + ')' : 'none'"
      (click)="select.emit(deal().id)"
    >
      <!-- ── Left ─────────────────────────── -->
      <div class="deal-left">
        <!-- Destination header -->
        <div class="dest-header">
          <span class="dest-city">{{ cityName() }}</span>
          <span class="dest-iata">({{ deal().destAirport }})</span>
          <span class="dest-sep">·</span>
          <span class="dest-country">{{ countryLabel() }}</span>
          @if (deal().mixedCarrier) {
            <span class="chip chip-amber">2 bilety</span>
          }
          @if (deal().openJaw) {
            <span class="chip chip-blue">Open-jaw</span>
          }
        </div>

        <!-- Flight legs -->
        <div class="legs">
          <!-- Departure leg -->
          <div class="leg">
            <span class="leg-dir out">Wylot</span>
            <span class="leg-route">
              <strong>{{ city(deal().originAirport) }}</strong>
              <span class="leg-code">({{ deal().originAirport }})</span>
              <span class="leg-arrow">→</span>
              <strong>{{ cityName() }}</strong>
              <span class="leg-code">({{ deal().destAirport }})</span>
            </span>
            <span class="leg-time-group">
              @if (spansTwo()) {
                <span class="week-dots week-dots--two">
                  <span class="wd-row">
                    @for (d of WEEK; track d.js) {
                      <span class="wd wd--{{ dayKindRow(d.js, 1) }}" [title]="d.label">
                        @if (dayKindRow(d.js, 1) === 'depart') {
                          <svg class="wd-shape" viewBox="0 0 6 8" fill="currentColor">
                            <polygon points="0,0 6,4 0,8" />
                          </svg>
                        } @else {
                          <span class="wd-dot"></span>
                        }
                      </span>
                    }
                  </span>
                  <span class="wd-row">
                    @for (d of WEEK; track d.js) {
                      <span class="wd wd--{{ dayKindRow(d.js, 2) }}" [title]="d.label">
                        @if (dayKindRow(d.js, 2) === 'return') {
                          <svg class="wd-shape" viewBox="0 0 6 8" fill="currentColor">
                            <polygon points="6,0 0,4 6,8" />
                          </svg>
                        } @else {
                          <span class="wd-dot"></span>
                        }
                      </span>
                    }
                  </span>
                </span>
              } @else {
                <span class="week-dots">
                  @for (d of WEEK; track d.js) {
                    <span class="wd wd--{{ dayKind(d.js) }}" [title]="d.label">
                      @switch (dayKind(d.js)) {
                        @case ('both') {
                          <svg class="wd-shape" viewBox="0 0 8 8" fill="currentColor">
                            <polygon points="4,0 8,4 4,8 0,4" />
                          </svg>
                        }
                        @case ('depart') {
                          <svg class="wd-shape" viewBox="0 0 6 8" fill="currentColor">
                            <polygon points="0,0 6,4 0,8" />
                          </svg>
                        }
                        @case ('return') {
                          <svg class="wd-shape" viewBox="0 0 6 8" fill="currentColor">
                            <polygon points="6,0 0,4 6,8" />
                          </svg>
                        }
                        @default {
                          <span class="wd-dot"></span>
                        }
                      }
                    </span>
                  }
                </span>
              }
              <span class="leg-time">
                <span class="leg-date">{{ fmtDate(deal().departAt) }}</span>
                <span class="leg-hour">{{ fmtTime(deal().departAt) }}</span>
              </span>
            </span>
            <span class="chip chip-neutral">{{ deal().outboundAirline }}</span>
          </div>

          <!-- Return leg -->
          <div class="leg">
            <span class="leg-dir ret">Powrót</span>
            <span class="leg-route">
              <strong>{{ cityName() }}</strong>
              <span class="leg-code">({{ deal().destAirport }})</span>
              <span class="leg-arrow">→</span>
              <strong>{{
                city(deal().openJaw ? deal().returnAirport : deal().originAirport)
              }}</strong>
              <span class="leg-code"
                >({{ deal().openJaw ? deal().returnAirport : deal().originAirport }})</span
              >
            </span>
            <span class="leg-time leg-time--ret">
              <span class="leg-date">{{ fmtDate(deal().returnAt) }}</span>
              <span class="leg-hour">{{ fmtTime(deal().returnAt) }}</span>
            </span>
            <span class="chip chip-neutral">{{ deal().returnAirline }}</span>
          </div>
        </div>
      </div>

      <!-- ── Right ────────────────────────── -->
      <div class="deal-right">
        <div class="price-block">
          <span class="price-from">od</span>
          <div class="price-val">
            {{ deal().totalPrice | number: '1.0-0' }}
            <span class="price-cur">PLN</span>
          </div>
          @if (deal().mixedCarrier) {
            <div class="price-split">
              {{ deal().outboundPrice | number: '1.0-0' }}+{{
                deal().returnPrice | number: '1.0-0'
              }}
            </div>
          }
        </div>
        <div class="cta-row">
          <button
            class="save-btn"
            [class.saved]="isSaved()"
            [attr.title]="isSaved() ? 'Usuń z zapisanych' : 'Zapisz'"
            (click)="onSave($event)"
          >
            {{ isSaved() ? '♥' : '♡' }}
          </button>
          <a
            class="btn-primary"
            [href]="bookingUrl()"
            target="_blank"
            rel="noopener"
            (click)="$event.stopPropagation()"
            >Sprawdź</a
          >
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .deal-row {
        display: grid;
        grid-template-columns: 1fr auto;
        align-items: center;
        gap: 24px;
        padding: 14px 20px;
        position: relative;
        background: var(--color-surface);
        border-bottom: 1px solid var(--color-border);
        border-left: 3px solid transparent;
        cursor: pointer;
        transition:
          background-color 0.1s,
          border-left-color 0.15s;
      }
      .deal-row::before {
        content: '';
        position: absolute;
        inset: 0;
        width: 220px;
        background: var(--thumb, none) center / cover no-repeat;
        mask-image: linear-gradient(to right, black 40%, transparent 100%);
        -webkit-mask-image: linear-gradient(to right, black 40%, transparent 100%);
        opacity: 0.45;
        pointer-events: none;
      }
      .deal-row:hover {
        background: var(--color-surface-hover);
      }
      .deal-row.selected {
        border-left-color: var(--color-blue-600);
      }
      :host(:last-child) .deal-row {
        border-bottom: none;
      }

      /* Left */
      .deal-left {
        display: flex;
        flex-direction: column;
        gap: 10px;
        min-width: 0;
      }

      /* Dest header */
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
      .dest-iata {
        font-size: 13px;
        font-weight: 500;
        color: var(--color-text-tertiary);
      }
      .dest-sep {
        color: var(--color-border-strong);
      }
      .dest-country {
        font-size: 13px;
        color: var(--color-text-secondary);
      }

      .leg-time-group {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-left: auto;
        flex-shrink: 0;
      }
      .week-dots {
        display: flex;
        gap: 4px;
        align-items: flex-end;
      }
      .week-dots--two {
        flex-direction: column;
        gap: 3px;
        align-items: flex-start;
      }
      .wd-row {
        display: flex;
        gap: 4px;
        align-items: flex-end;
      }
      .wd {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;
      }
      .wd-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--color-border-strong);
        transition: background 0.15s;
      }
      .wd-shape {
        width: 6px;
        height: 7px;
        flex-shrink: 0;
        color: var(--color-border-strong);
        transition: color 0.15s;
      }
      /* full-color: departure, return, both */
      .wd--depart .wd-shape,
      .wd--return .wd-shape,
      .wd--both .wd-shape {
        color: var(--color-blue-600);
      }
      /* mid: days between — medium blue */
      .wd--mid .wd-dot {
        background: #60a5fa;
      }

      /* Chips / badges */
      .chip {
        display: inline-flex;
        align-items: center;
        padding: 2px 8px;
        border-radius: var(--radius-full);
        font-size: 11px;
        font-weight: 500;
        white-space: nowrap;
      }
      .chip-green {
        background: var(--color-green-100);
        color: var(--color-green-600);
      }
      .chip-amber {
        background: var(--color-amber-100);
        color: var(--color-amber-700);
      }
      .chip-blue {
        background: var(--color-blue-100);
        color: var(--color-blue-800);
      }
      .chip-neutral {
        background: var(--color-sidebar-active);
        color: var(--color-text-secondary);
      }

      /* Legs */
      .legs {
        display: flex;
        flex-direction: column;
        gap: 3px;
      }

      .leg {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
        font-size: 13px;
      }

      .leg-dir {
        flex-shrink: 0;
        min-width: 48px;
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        padding: 2px 6px;
        border-radius: var(--radius-sm);
      }
      .leg-dir.out {
        background: var(--color-blue-50);
        color: var(--color-blue-700);
      }
      .leg-dir.ret {
        background: var(--color-sidebar-active);
        color: var(--color-text-secondary);
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

      .leg-time {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-shrink: 0;
      }
      .leg-time--ret {
        margin-left: auto;
      }
      .leg-date {
        font-size: 12px;
        color: var(--color-text-secondary);
      }
      .leg-hour {
        font-size: 14px;
        font-weight: 700;
        color: var(--color-text-primary);
        font-variant-numeric: tabular-nums;
      }

      /* Right */
      .deal-right {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 10px;
        flex-shrink: 0;
      }

      .price-block {
        text-align: right;
      }
      .price-from {
        display: block;
        font-size: 10px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--color-text-tertiary);
      }
      .price-val {
        font-size: 24px;
        font-weight: 800;
        color: var(--color-text-primary);
        line-height: 1.1;
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
      }
      .price-cur {
        font-size: 14px;
        font-weight: 500;
        color: var(--color-text-secondary);
        margin-left: 2px;
      }
      .price-split {
        font-size: 11px;
        color: var(--color-text-tertiary);
      }

      .cta-row {
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .save-btn {
        padding: 5px 8px;
        border-radius: var(--radius-md);
        border: none;
        background: transparent;
        font-size: 17px;
        line-height: 1;
        cursor: pointer;
        color: var(--color-text-tertiary);
        transition: color 0.12s;
      }
      .save-btn:hover,
      .save-btn.saved {
        color: #e11d48;
      }

      .btn-primary {
        display: inline-flex;
        align-items: center;
        padding: 7px 18px;
        border-radius: var(--radius-md);
        font-size: 13px;
        font-weight: 600;
        background: var(--color-blue-700);
        color: #fff;
        text-decoration: none;
        white-space: nowrap;
        transition: background 0.12s;
      }
      .btn-primary:hover {
        background: var(--color-blue-800);
      }
    `,
  ],
})
export class DealCardComponent {
  deal = input.required<Deal>();
  selected = input<boolean>(false);
  select = output<string>();

  private savedService = inject(SavedDealsService);
  private airportsSvc = inject(AirportsService);
  private cityImagesSvc = inject(CityImagesService);
  isSaved = computed(() => this.savedService.isSaved(this.deal().id));

  readonly fmtDate = fmtDate;
  readonly fmtTime = fmtTime;
  readonly WEEK = WEEK;

  city = (code: string) => this.airportsSvc.cityName(code);

  tripDays = computed(() => activeDays(this.deal().departAt, this.deal().returnAt));
  departDay = computed(() => new Date(this.deal().departAt).getUTCDay());
  returnDay = computed(() => new Date(this.deal().returnAt).getUTCDay());

  spansTwo = computed(() => {
    const d = new Date(this.deal().departAt);
    d.setUTCHours(0, 0, 0, 0);
    const r = new Date(this.deal().returnAt);
    r.setUTCHours(0, 0, 0, 0);
    // Monday of each date's calendar week (Pn–Nd)
    const dMon = new Date(d);
    dMon.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    const rMon = new Date(r);
    rMon.setUTCDate(r.getUTCDate() - ((r.getUTCDay() + 6) % 7));
    return dMon.getTime() !== rMon.getTime();
  });

  private twoRows = computed(() => {
    const d = new Date(this.deal().departAt);
    d.setUTCHours(0, 0, 0, 0);
    const r = new Date(this.deal().returnAt);
    r.setUTCHours(0, 0, 0, 0);
    const dMon = new Date(d);
    dMon.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    const rMon = new Date(r);
    rMon.setUTCDate(r.getUTCDate() - ((r.getUTCDay() + 6) % 7));
    // Row 1: departure day → end of departure week (Sunday)
    const dSun = new Date(dMon);
    dSun.setUTCDate(dMon.getUTCDate() + 6);
    dSun.setUTCHours(23, 59, 59, 0);
    // Row 2: Monday of return week → return day
    const rEnd = new Date(r);
    rEnd.setUTCHours(23, 59, 59, 0);
    const row1 = new Set<number>(),
      row2 = new Set<number>();
    const c1 = new Date(d);
    while (c1 <= dSun) {
      row1.add(c1.getUTCDay());
      c1.setUTCDate(c1.getUTCDate() + 1);
    }
    const c2 = new Date(rMon);
    while (c2 <= rEnd) {
      row2.add(c2.getUTCDay());
      c2.setUTCDate(c2.getUTCDate() + 1);
    }
    return { row1, row2 };
  });

  dayKind(jsDay: number): 'both' | 'depart' | 'return' | 'mid' | 'off' {
    const d = this.departDay(),
      r = this.returnDay();
    if (jsDay === d && jsDay === r) return 'both';
    if (jsDay === d) return 'depart';
    if (jsDay === r) return 'return';
    if (this.tripDays().has(jsDay)) return 'mid';
    return 'off';
  }

  dayKindRow(jsDay: number, row: 1 | 2): 'depart' | 'return' | 'mid' | 'off' {
    if (row === 1) {
      if (jsDay === this.departDay()) return 'depart';
      if (this.twoRows().row1.has(jsDay)) return 'mid';
      return 'off';
    } else {
      if (jsDay === this.returnDay()) return 'return';
      if (this.twoRows().row2.has(jsDay)) return 'mid';
      return 'off';
    }
  }

  cityName(): string {
    return this.airportsSvc.cityName(this.deal().destAirport);
  }

  thumbUrl = computed(() => this.cityImagesSvc.imageUrl(this.cityName()));
  countryLabel(): string {
    return COUNTRY_NAMES[this.deal().destCountry] ?? this.deal().destCountry;
  }
  isGoodDeal(): boolean {
    return this.deal().totalPrice < 400;
  }
  bookingUrl(): string {
    return this.deal().outboundBookingUrl ?? this.deal().returnBookingUrl ?? '#';
  }

  onSave(e: Event) {
    e.stopPropagation();
    this.savedService.toggle(this.deal());
  }
}
