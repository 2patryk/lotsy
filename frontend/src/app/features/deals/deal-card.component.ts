import { Component, input, output, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmBadge } from '@spartan-ng/helm/badge';
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
  imports: [CommonModule, HlmButton, HlmBadge],
  template: `
    <div
      class="deal-row relative grid cursor-pointer grid-cols-[1fr_auto] items-center gap-3 border-b border-b-border border-l-[3px] border-l-transparent bg-card px-3.5 py-3 transition-colors hover:bg-accent/40 sm:gap-6 sm:px-5 sm:py-3.5"
      [class.border-l-primary!]="selected()"
      [class.has-photo]="!!thumbUrl()"
      [style.--thumb]="thumbUrl() ? 'url(' + thumbUrl() + ')' : 'none'"
      (click)="select.emit(deal().id)"
    >
      <!-- ── Left ─────────────────────────── -->
      <div class="relative z-10 flex min-w-0 flex-col gap-2.5">
        <!-- Destination header -->
        <div class="flex flex-wrap items-center gap-1.5">
          <span class="text-[15px] font-bold">{{ cityName() }}</span>
          <span class="text-[13px] font-medium text-muted-foreground max-sm:hidden"
            >({{ deal().destAirport }})</span
          >
          <span class="text-border max-sm:hidden">·</span>
          <span class="text-[13px] text-muted-foreground">{{ countryLabel() }}</span>
          @if (deal().mixedCarrier) {
            <span hlmBadge class="border-transparent bg-brand/15 text-brand">2 bilety</span>
          }
          @if (deal().openJaw) {
            <span hlmBadge class="border-transparent bg-primary/10 text-primary">Open-jaw</span>
          }
        </div>

        <!-- Flight legs -->
        <div class="flex flex-col gap-1">
          <!-- Departure leg -->
          <div class="flex flex-wrap items-center gap-1.5 text-[13px] sm:gap-2.5">
            <span
              class="min-w-12 shrink-0 rounded-sm bg-primary/10 px-1.5 py-0.5 text-center text-[10px] font-bold tracking-wide text-primary uppercase"
              >Wylot</span
            >
            <span class="flex flex-wrap items-center gap-1 max-sm:hidden">
              <strong class="font-semibold">{{ city(deal().originAirport) }}</strong>
              <span class="font-normal text-muted-foreground">({{ deal().originAirport }})</span>
              <span class="mx-0.5 text-muted-foreground">→</span>
              <strong class="font-semibold">{{ cityName() }}</strong>
              <span class="font-normal text-muted-foreground">({{ deal().destAirport }})</span>
            </span>
            <span class="flex shrink-0 items-center gap-2.5 sm:ml-auto">
              @if (spansTwo()) {
                <span class="flex flex-col items-start gap-[3px] max-sm:hidden">
                  <span class="flex items-end gap-1">
                    @for (d of WEEK; track d.js) {
                      <span
                        class="wd wd--{{ dayKindRow(d.js, 1) }} flex flex-col items-center"
                        [title]="d.label"
                      >
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
                  <span class="flex items-end gap-1">
                    @for (d of WEEK; track d.js) {
                      <span
                        class="wd wd--{{ dayKindRow(d.js, 2) }} flex flex-col items-center"
                        [title]="d.label"
                      >
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
                <span class="flex items-end gap-1 max-sm:hidden">
                  @for (d of WEEK; track d.js) {
                    <span
                      class="wd wd--{{ dayKind(d.js) }} flex flex-col items-center"
                      [title]="d.label"
                    >
                      @switch (dayKind(d.js)) {
                        @case ('both') {
                          <svg
                            class="wd-shape wd-shape--wide"
                            viewBox="0 0 8 8"
                            fill="currentColor"
                          >
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
              <span class="flex shrink-0 items-center gap-1.5">
                <span class="text-xs text-muted-foreground">{{ fmtDate(deal().departAt) }}</span>
                <span class="text-sm font-bold tabular-nums">{{ fmtTime(deal().departAt) }}</span>
              </span>
            </span>
            <span hlmBadge variant="secondary" class="border-transparent font-medium">{{
              deal().outboundAirline
            }}</span>
          </div>

          <!-- Return leg -->
          <div class="flex flex-wrap items-center gap-1.5 text-[13px] sm:gap-2.5">
            <span
              class="min-w-12 shrink-0 rounded-sm bg-secondary px-1.5 py-0.5 text-center text-[10px] font-bold tracking-wide text-muted-foreground uppercase"
              >Powrót</span
            >
            <span class="flex flex-wrap items-center gap-1 max-sm:hidden">
              <strong class="font-semibold">{{ cityName() }}</strong>
              <span class="font-normal text-muted-foreground">({{ deal().destAirport }})</span>
              <span class="mx-0.5 text-muted-foreground">→</span>
              <strong class="font-semibold">{{
                city(deal().openJaw ? deal().returnAirport : deal().originAirport)
              }}</strong>
              <span class="font-normal text-muted-foreground"
                >({{ deal().openJaw ? deal().returnAirport : deal().originAirport }})</span
              >
            </span>
            <span class="flex shrink-0 items-center gap-1.5 sm:ml-auto">
              <span class="text-xs text-muted-foreground">{{ fmtDate(deal().returnAt) }}</span>
              <span class="text-sm font-bold tabular-nums">{{ fmtTime(deal().returnAt) }}</span>
            </span>
            <span hlmBadge variant="secondary" class="border-transparent font-medium">{{
              deal().returnAirline
            }}</span>
          </div>
        </div>
      </div>

      <!-- ── Right ────────────────────────── -->
      <div class="relative z-10 flex shrink-0 flex-col items-end gap-2.5">
        <div class="text-right">
          <span
            class="block text-[10px] font-semibold tracking-widest text-muted-foreground uppercase"
            >od</span
          >
          <div
            class="text-xl leading-tight font-extrabold whitespace-nowrap tabular-nums sm:text-2xl"
          >
            {{ deal().totalPrice | number: '1.0-0' }}
            <span class="text-sm font-medium text-muted-foreground">PLN</span>
          </div>
          @if (deal().mixedCarrier) {
            <div class="text-[11px] text-muted-foreground">
              {{ deal().outboundPrice | number: '1.0-0' }}+{{
                deal().returnPrice | number: '1.0-0'
              }}
            </div>
          }
        </div>
        <div class="flex items-center gap-1.5">
          <button
            hlmBtn
            variant="ghost"
            size="icon-sm"
            class="text-base text-muted-foreground hover:text-destructive"
            [class.text-destructive]="isSaved()"
            [attr.title]="isSaved() ? 'Usuń z zapisanych' : 'Zapisz'"
            (click)="onSave($event)"
          >
            {{ isSaved() ? '♥' : '♡' }}
          </button>
          <a
            hlmBtn
            size="sm"
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
      /* City-photo backdrop and week-dot glyphs are custom visuals with no
         utility-class equivalent; everything else lives in the template. */
      .deal-row::before {
        content: '';
        position: absolute;
        top: 0;
        bottom: 0;
        left: -3px;
        width: 200px;
        background: var(--thumb, none) center / cover no-repeat;
        mask-image: linear-gradient(to right, black 0%, transparent 100%);
        -webkit-mask-image: linear-gradient(to right, black 0%, transparent 100%);
        opacity: 0.46;
        pointer-events: none;
        z-index: 0;
      }
      @media (min-width: 640px) {
        .deal-row.has-photo {
          padding-left: 88px;
        }
      }
      @media (max-width: 639.98px) {
        .deal-row::before {
          display: none;
        }
      }
      :host(:last-child) .deal-row {
        border-bottom: none;
      }

      .wd-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--border);
      }
      .wd-shape {
        width: 6px;
        height: 7px;
        flex-shrink: 0;
        color: var(--border);
      }
      .wd--depart .wd-shape,
      .wd--return .wd-shape,
      .wd--both .wd-shape {
        color: var(--primary);
      }
      .wd--mid .wd-dot {
        background: var(--primary);
        opacity: 0.4;
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
