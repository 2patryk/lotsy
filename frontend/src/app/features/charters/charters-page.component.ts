import { Component, inject, signal, computed, HostListener } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmBadge } from '@spartan-ng/helm/badge';
import { HlmInput } from '@spartan-ng/helm/input';
import { HlmSpinner } from '@spartan-ng/helm/spinner';
import { ChartersService } from '../../core/services/charters.service';
import type { CharterFlight, ChartersMeta } from '../../core/models/charter-offer.model';

type PriceMode = 'roundTrip' | 'oneWay';

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
  selector: 'app-charters-page',
  standalone: true,
  imports: [CommonModule, DecimalPipe, HlmButton, HlmBadge, HlmInput, HlmSpinner],
  template: `
    <main class="mx-auto flex w-full max-w-[1100px] flex-col gap-5 px-3 py-7 sm:px-6">
      <div class="flex flex-col gap-1">
        <h1 class="text-2xl font-bold tracking-tight">Loty czarterowe</h1>
        <p class="text-sm text-muted-foreground">
          Bilety czarterowe Rainbow · cena za osobę
          @if (lastUpdate()) {
            <span class="text-muted-foreground/70"> · Odświeżono: {{ lastUpdate() }}</span>
          }
        </p>
      </div>

      <!-- ── Filter card ───────────────────── -->
      <section class="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 shadow-xs">
        <div class="flex flex-wrap items-end gap-x-4 gap-y-3">
          <!-- Mode -->
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-medium text-muted-foreground">Typ biletu</label>
            <div
              class="inline-flex gap-0.5 rounded-lg border border-border bg-muted p-0.5"
              role="tablist"
            >
              <button
                hlmBtn
                size="sm"
                role="tab"
                class="h-7"
                [variant]="mode() === 'roundTrip' ? 'default' : 'ghost'"
                (click)="setMode('roundTrip')"
              >
                W obie strony
              </button>
              <button
                hlmBtn
                size="sm"
                role="tab"
                class="h-7"
                [variant]="mode() === 'oneWay' ? 'default' : 'ghost'"
                (click)="setMode('oneWay')"
              >
                W jedną stronę
              </button>
            </div>
          </div>

          <!-- Departure airport -->
          <div
            class="relative flex min-w-36 flex-1 flex-col gap-1.5"
            (click)="$event.stopPropagation()"
          >
            <label class="text-xs font-medium text-muted-foreground">Lotnisko wylotu</label>
            <button
              hlmBtn
              variant="outline"
              size="sm"
              class="w-full justify-between gap-2 font-normal"
              [class.border-primary]="selectedOrigins().size > 0"
              [class.text-primary]="selectedOrigins().size > 0"
              (click)="toggleDropdown('origin')"
            >
              <span class="truncate">{{ originLabel() }}</span>
              <svg
                class="shrink-0 text-muted-foreground transition-transform"
                [class.rotate-180]="openDropdown() === 'origin'"
                width="10"
                height="6"
                viewBox="0 0 10 6"
              >
                <path d="M1 1l4 4 4-4" stroke="currentColor" stroke-width="1.5" fill="none" />
              </svg>
            </button>
            @if (openDropdown() === 'origin') {
              <div
                class="absolute top-full left-0 z-50 mt-1 max-h-64 min-w-52 overflow-y-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md"
              >
                @for (o of meta().origins; track o.iata) {
                  <label
                    class="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                  >
                    <input
                      type="checkbox"
                      class="size-3.5 shrink-0 accent-primary"
                      [checked]="selectedOrigins().has(o.iata)"
                      (change)="toggleOrigin(o.iata)"
                    />
                    {{ o.name }} <span class="text-muted-foreground">({{ o.iata }})</span>
                  </label>
                }
              </div>
            }
          </div>

          <!-- Destination country -->
          <div
            class="relative flex min-w-36 flex-1 flex-col gap-1.5"
            (click)="$event.stopPropagation()"
          >
            <label class="text-xs font-medium text-muted-foreground">Kraj przylotu</label>
            <button
              hlmBtn
              variant="outline"
              size="sm"
              class="w-full justify-between gap-2 font-normal"
              [class.border-primary]="selectedCountries().size > 0"
              [class.text-primary]="selectedCountries().size > 0"
              (click)="toggleDropdown('country')"
            >
              <span class="truncate">{{ countryLabel() }}</span>
              <svg
                class="shrink-0 text-muted-foreground transition-transform"
                [class.rotate-180]="openDropdown() === 'country'"
                width="10"
                height="6"
                viewBox="0 0 10 6"
              >
                <path d="M1 1l4 4 4-4" stroke="currentColor" stroke-width="1.5" fill="none" />
              </svg>
            </button>
            @if (openDropdown() === 'country') {
              <div
                class="absolute top-full left-0 z-50 mt-1 max-h-64 min-w-52 overflow-y-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md"
              >
                @for (c of meta().countries; track c) {
                  <label
                    class="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                  >
                    <input
                      type="checkbox"
                      class="size-3.5 shrink-0 accent-primary"
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
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-medium text-muted-foreground">Wylot od</label>
            <input
              hlmInput
              class="h-8 w-36"
              type="date"
              [value]="dateFrom()"
              [min]="minDate()"
              [max]="maxDate()"
              (change)="setDateFrom($event)"
            />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-medium text-muted-foreground">Wylot do</label>
            <input
              hlmInput
              class="h-8 w-36"
              type="date"
              [value]="dateTo()"
              [min]="minDate()"
              [max]="maxDate()"
              (change)="setDateTo($event)"
            />
          </div>
        </div>

        <!-- Row 2: day-of-week pills + price range + sort + reset -->
        <div class="flex flex-wrap items-end gap-x-4 gap-y-3 border-t border-border pt-4">
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-medium text-muted-foreground">Dni tygodnia wylotu</label>
            <div class="flex items-center gap-1">
              @for (d of DAYS; track d.js) {
                <button
                  hlmBtn
                  size="sm"
                  [variant]="selectedDays().has(d.js) ? 'default' : 'outline'"
                  class="h-7 shrink-0 rounded-full px-2.5 text-xs"
                  (click)="toggleDay(d.js)"
                >
                  {{ d.label }}
                </button>
              }
            </div>
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-medium text-muted-foreground">Cena od (zł)</label>
            <input
              hlmInput
              class="h-8 w-24"
              type="number"
              min="0"
              placeholder="min"
              [value]="minPrice() ?? ''"
              (change)="setMinPrice($event)"
            />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-medium text-muted-foreground">Cena do (zł)</label>
            <input
              hlmInput
              class="h-8 w-24"
              type="number"
              min="0"
              placeholder="max"
              [value]="maxPrice() ?? ''"
              (change)="setMaxPrice($event)"
            />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-medium text-muted-foreground">Sortowanie</label>
            <select
              class="h-8 cursor-pointer rounded-md border border-input bg-background px-2.5 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              [value]="sort()"
              (change)="setSort($event)"
            >
              <option value="price">Najtańsze najpierw</option>
              <option value="date">Data wylotu</option>
            </select>
          </div>
          @if (hasFilters()) {
            <button hlmBtn variant="outline" size="sm" (click)="clearFilters()">
              Wyczyść filtry
            </button>
          }
        </div>
      </section>

      <div class="flex items-center">
        <span class="text-sm font-medium text-muted-foreground">
          {{ flights().length }} lotów
          @if (flights().length === 300) {
            <span class="text-muted-foreground/70">(pokazuję pierwsze 300)</span>
          }
        </span>
      </div>

      @if (loading()) {
        <div class="flex items-center justify-center gap-3 py-16 text-sm text-muted-foreground">
          <hlm-spinner class="size-5" />
          <span>Ładowanie…</span>
        </div>
      } @else if (error()) {
        <div class="rounded-xl border border-border bg-card px-6 py-5 text-sm text-destructive">
          Nie udało się pobrać ofert. Spróbuj ponownie później.
        </div>
      } @else if (flights().length === 0) {
        <div
          class="flex flex-col items-center gap-3 rounded-xl border border-border bg-card px-5 py-20 text-center"
        >
          <div class="text-4xl text-muted-foreground/50">✈</div>
          <div class="font-semibold">Brak lotów dla wybranych filtrów</div>
          <div class="text-sm text-muted-foreground">Zmień lotnisko, kraj lub daty</div>
          @if (hasFilters()) {
            <button hlmBtn variant="outline" size="sm" (click)="clearFilters()">
              Wyczyść filtry
            </button>
          }
        </div>
      } @else {
        <section
          class="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-xs"
        >
          @for (f of flights(); track f.id) {
            <div
              class="offer-row relative grid grid-cols-[1fr_auto] items-center gap-3 px-3.5 py-3 transition-colors hover:bg-accent/40 sm:gap-6 sm:px-5 sm:py-3.5"
              [class.has-photo]="!!f.imageUrl"
              [style.--thumb]="f.imageUrl ? 'url(' + f.imageUrl + ')' : 'none'"
            >
              <!-- ── Left ─────────────────────── -->
              <div class="relative z-10 flex min-w-0 flex-col gap-2.5">
                <div class="flex flex-wrap items-center gap-1.5">
                  <span class="text-[15px] font-bold">{{ f.destName }}</span>
                  <span class="text-[13px] font-medium text-muted-foreground max-sm:hidden"
                    >({{ f.destIata }})</span
                  >
                  <span class="text-border max-sm:hidden">·</span>
                  <span class="text-[13px] text-muted-foreground">{{ f.destCountry }}</span>
                  @if (f.nights != null) {
                    <span hlmBadge class="border-transparent bg-primary/10 text-primary"
                      >{{ f.nights }} nocy</span
                    >
                  }
                  @if (f.baggageKg) {
                    <span hlmBadge variant="secondary" class="border-transparent"
                      >Bagaż {{ f.baggageKg }} kg</span
                    >
                  }
                </div>

                <div class="flex flex-col gap-1">
                  <div class="flex flex-wrap items-center gap-1.5 text-[13px] sm:gap-2.5">
                    <span
                      class="min-w-12 shrink-0 rounded-sm bg-primary/10 px-1.5 py-0.5 text-center text-[10px] font-bold tracking-wide text-primary uppercase"
                      >Wylot</span
                    >
                    <span class="flex shrink-0 items-center gap-1.5">
                      <span class="text-xs text-muted-foreground">{{ fmtDate(f.date) }}</span>
                      <span class="text-sm font-bold tabular-nums">{{ f.depTime }}</span>
                      <span class="font-semibold"
                        >{{ f.depAirport }}
                        <span class="font-normal text-muted-foreground"
                          >({{ f.depIata }})</span
                        ></span
                      >
                    </span>
                    <span class="flex flex-wrap items-center gap-1 max-sm:hidden">
                      <span class="mx-0.5 text-muted-foreground">→</span>
                      <strong class="font-semibold">{{ f.destName }}</strong>
                      <span class="font-normal text-muted-foreground">({{ f.destIata }})</span>
                      <span class="text-xs text-muted-foreground">przylot {{ f.arrTime }}</span>
                    </span>
                    <span hlmBadge variant="secondary" class="gap-1 border-transparent font-medium"
                      >{{ f.airline }}
                      @if (f.flightNo) {
                        <span class="font-normal opacity-70">{{ f.flightNo }}</span>
                      }
                    </span>
                  </div>

                  @if (f.returnDate) {
                    <div class="flex flex-wrap items-center gap-1.5 text-[13px] sm:gap-2.5">
                      <span
                        class="min-w-12 shrink-0 rounded-sm bg-secondary px-1.5 py-0.5 text-center text-[10px] font-bold tracking-wide text-muted-foreground uppercase"
                        >Powrót</span
                      >
                      <span class="flex shrink-0 items-center gap-1.5">
                        <span class="text-xs text-muted-foreground">{{
                          fmtDate(f.returnDate)
                        }}</span>
                        <span class="text-sm font-bold tabular-nums">{{ f.retDepTime }}</span>
                        <span class="font-semibold"
                          >{{ f.destName }}
                          <span class="font-normal text-muted-foreground"
                            >({{ f.destIata }})</span
                          ></span
                        >
                      </span>
                      <span class="flex flex-wrap items-center gap-1 max-sm:hidden">
                        <span class="mx-0.5 text-muted-foreground">→</span>
                        <strong class="font-semibold">{{ f.retArrAirport }}</strong>
                        <span class="font-normal text-muted-foreground">({{ f.retArrIata }})</span>
                        <span class="text-xs text-muted-foreground"
                          >przylot {{ f.retArrTime }}</span
                        >
                      </span>
                      <span
                        hlmBadge
                        variant="secondary"
                        class="gap-1 border-transparent font-medium"
                        >{{ f.retAirline }}
                        @if (f.retFlightNo) {
                          <span class="font-normal opacity-70">{{ f.retFlightNo }}</span>
                        }
                      </span>
                    </div>
                  }
                </div>
              </div>

              <!-- ── Right ────────────────────── -->
              <div class="relative z-10 flex shrink-0 flex-col items-end gap-2.5">
                <div class="text-right">
                  <div
                    class="text-xl leading-tight font-extrabold whitespace-nowrap tabular-nums sm:text-2xl"
                  >
                    {{ f.totalPrice | number: '1.0-0' }}
                    <span class="text-sm font-medium text-muted-foreground">PLN</span>
                  </div>
                  <div class="text-[11px] text-muted-foreground">
                    @if (f.returnPrice != null) {
                      w obie strony ({{ f.price | number: '1.0-0' }} +
                      {{ f.returnPrice | number: '1.0-0' }})
                    } @else {
                      w jedną stronę
                    }
                  </div>
                </div>
                <a hlmBtn size="sm" [href]="bookingUrl(f)" target="_blank" rel="noopener"
                  >Sprawdź</a
                >
              </div>
            </div>
          }
        </section>
      }
    </main>
  `,
  styles: [
    `
      /* Destination-photo backdrop has no utility-class equivalent. */
      .offer-row::before {
        content: '';
        position: absolute;
        top: 0;
        bottom: 0;
        left: 0;
        width: 200px;
        background: var(--thumb, none) center / cover no-repeat;
        mask-image: linear-gradient(to right, black 0%, transparent 100%);
        -webkit-mask-image: linear-gradient(to right, black 0%, transparent 100%);
        opacity: 0.46;
        pointer-events: none;
        z-index: 0;
      }
      @media (min-width: 640px) {
        .offer-row.has-photo {
          padding-left: 88px;
        }
      }
      @media (max-width: 639.98px) {
        .offer-row::before {
          display: none;
        }
      }
    `,
  ],
})
export class ChartersPageComponent {
  private chartersService = inject(ChartersService);

  readonly DAYS = DAYS;

  mode = signal<PriceMode>('roundTrip');
  loading = signal(true);
  error = signal(false);
  flights = signal<CharterFlight[]>([]);
  meta = signal<ChartersMeta>({
    origins: [],
    countries: [],
    minDate: null,
    maxDate: null,
    minPrice: null,
    maxPrice: null,
    lastUpdate: null,
  });

  openDropdown = signal<'origin' | 'country' | null>(null);
  selectedOrigins = signal<Set<string>>(new Set());
  selectedCountries = signal<Set<string>>(new Set());
  selectedDays = signal<Set<number>>(new Set());
  dateFrom = signal<string>('');
  dateTo = signal<string>('');
  minPrice = signal<number | null>(null);
  maxPrice = signal<number | null>(null);
  sort = signal<'price' | 'date'>('price');

  lastUpdate = computed(() => {
    const ts = this.meta().lastUpdate;
    if (!ts) return null;
    return new Date(ts).toLocaleString('pl-PL', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  });
  minDate = computed(() => this.meta().minDate?.slice(0, 10) ?? '');
  maxDate = computed(() => this.meta().maxDate?.slice(0, 10) ?? '');

  originLabel = computed(() => {
    const n = this.selectedOrigins().size;
    return n === 0 ? 'Wszystkie' : n === 1 ? [...this.selectedOrigins()][0] : `${n} lotnisk`;
  });
  countryLabel = computed(() => {
    const sel = this.selectedCountries();
    return sel.size === 0 ? 'Wszystkie' : sel.size === 1 ? [...sel][0] : `${sel.size} krajów`;
  });
  hasFilters = computed(
    () =>
      this.selectedOrigins().size > 0 ||
      this.selectedCountries().size > 0 ||
      this.selectedDays().size > 0 ||
      !!this.dateFrom() ||
      !!this.dateTo() ||
      this.minPrice() != null ||
      this.maxPrice() != null,
  );

  constructor() {
    this.chartersService.getMeta().subscribe((m) => this.meta.set(m));
    this.load();
  }

  @HostListener('document:click')
  closeDropdowns() {
    this.openDropdown.set(null);
  }

  toggleDropdown(which: 'origin' | 'country') {
    this.openDropdown.set(this.openDropdown() === which ? null : which);
  }

  setMode(mode: PriceMode) {
    if (this.mode() === mode) return;
    this.mode.set(mode);
    this.load();
  }

  toggleOrigin(iata: string) {
    const next = new Set(this.selectedOrigins());
    if (next.has(iata)) next.delete(iata);
    else next.add(iata);
    this.selectedOrigins.set(next);
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

  setMinPrice(e: Event) {
    const v = (e.target as HTMLInputElement).value;
    this.minPrice.set(v ? Number(v) : null);
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
    this.selectedOrigins.set(new Set());
    this.selectedCountries.set(new Set());
    this.selectedDays.set(new Set());
    this.dateFrom.set('');
    this.dateTo.set('');
    this.minPrice.set(null);
    this.maxPrice.set(null);
    this.load();
  }

  private load() {
    this.loading.set(true);
    this.error.set(false);
    this.chartersService
      .getFlights({
        oneWay: this.mode() === 'oneWay',
        origin: [...this.selectedOrigins()].join(',') || undefined,
        destCountry: [...this.selectedCountries()].join(',') || undefined,
        dateFrom: this.dateFrom() || undefined,
        dateTo: this.dateTo() || undefined,
        days: [...this.selectedDays()].join(',') || undefined,
        minPrice: this.minPrice() ?? undefined,
        maxPrice: this.maxPrice() ?? undefined,
        sort: this.sort(),
      })
      .subscribe({
        next: (flights) => {
          this.flights.set(flights);
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

  bookingUrl(f: CharterFlight): string {
    const base = `https://r.pl/bilety-czarterowe/${f.destCountryUrl}/${f.destNameUrl}`;
    const params = new URLSearchParams({
      oneWay: String(f.oneWay),
      data: f.date.slice(0, 10),
    });
    if (f.pakietId) params.set('idWylot', f.pakietId);
    if (f.retPakietId) params.set('idPrzylot', f.retPakietId);
    return `${base}?${params}`;
  }
}
