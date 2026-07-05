import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmBadge } from '@spartan-ng/helm/badge';
import { HlmInput } from '@spartan-ng/helm/input';
import { HlmSpinner } from '@spartan-ng/helm/spinner';
import {
  MultiSelectDropdownComponent,
  type MultiSelectOption,
} from '../../shared/filters/multi-select-dropdown.component';
import {
  SegmentedToggleComponent,
  type SegmentOption,
} from '../../shared/filters/segmented-toggle.component';
import { DayPillsComponent } from '../../shared/filters/day-pills.component';
import { SortSelectComponent, type SortOption } from '../../shared/filters/sort-select.component';
import { FilterCardComponent } from '../../shared/filters/filter-card.component';
import { ChartersService } from '../../core/services/charters.service';
import type { CharterFlight, ChartersMeta } from '../../core/models/charter-offer.model';

type PriceMode = 'roundTrip' | 'oneWay';

const WD = ['ndz', 'pon', 'wt', 'śr', 'czw', 'pt', 'sob'];
const MON = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'];

@Component({
  selector: 'app-charters-page',
  standalone: true,
  imports: [
    CommonModule,
    DecimalPipe,
    HlmButton,
    HlmBadge,
    HlmInput,
    HlmSpinner,
    MultiSelectDropdownComponent,
    SegmentedToggleComponent,
    DayPillsComponent,
    SortSelectComponent,
    FilterCardComponent,
  ],
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
      <app-filter-card
        [filterCount]="activeFilterCount()"
        [resultsCount]="flights().length"
        (cleared)="clearFilters()"
      >
        <div class="flex flex-wrap items-end gap-x-4 gap-y-3">
          <!-- Mode -->
          <app-segmented-toggle
            label="Typ biletu"
            [options]="modeOptions"
            [value]="mode()"
            (changed)="setModeValue($event)"
          />

          <!-- Departure airport -->
          <app-multi-select-dropdown
            label="Lotnisko wylotu"
            [options]="originOptions()"
            [selected]="selectedOriginsArr()"
            [summary]="originSummary"
            (toggled)="toggleOrigin($event)"
          />

          <!-- Destination country -->
          <app-multi-select-dropdown
            label="Kraj przylotu"
            [options]="countryOptions()"
            [selected]="selectedCountriesArr()"
            [summary]="countrySummary"
            (toggled)="toggleCountry($event)"
          />

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
            <app-day-pills [selected]="selectedDaysArr()" (toggled)="toggleDay($event)" />
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
          <app-sort-select
            [options]="sortOptions"
            [value]="sort()"
            (changed)="setSortValue($event)"
          />
          @if (hasFilters()) {
            <button hlmBtn variant="outline" size="sm" (click)="clearFilters()">
              Wyczyść filtry
            </button>
          }
        </div>
      </app-filter-card>

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

  // Shared filter-component wiring
  readonly modeOptions: SegmentOption[] = [
    { value: 'roundTrip', label: 'W obie strony' },
    { value: 'oneWay', label: 'W jedną stronę' },
  ];
  originOptions = computed<MultiSelectOption[]>(() =>
    this.meta().origins.map((o) => ({ value: o.iata, label: `${o.name} (${o.iata})` })),
  );
  countryOptions = computed<MultiSelectOption[]>(() =>
    this.meta().countries.map((c) => ({ value: c, label: c })),
  );
  selectedOriginsArr = computed(() => [...this.selectedOrigins()]);
  selectedCountriesArr = computed(() => [...this.selectedCountries()]);
  selectedDaysArr = computed(() => [...this.selectedDays()]);
  readonly sortOptions: SortOption[] = [
    { value: 'price', label: 'Najtańsze najpierw' },
    { value: 'date', label: 'Data wylotu' },
  ];
  readonly originSummary = (sel: string[]) => (sel.length === 1 ? sel[0] : `${sel.length} lotnisk`);
  readonly countrySummary = (sel: string[]) => (sel.length === 1 ? sel[0] : `${sel.length} krajów`);

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
  // Count of active filter categories, shown as a badge on the mobile "Filtry" button.
  activeFilterCount = computed(() => {
    let n = 0;
    if (this.selectedOrigins().size > 0) n++;
    if (this.selectedCountries().size > 0) n++;
    if (this.dateFrom()) n++;
    if (this.dateTo()) n++;
    if (this.selectedDays().size > 0) n++;
    if (this.minPrice() != null) n++;
    if (this.maxPrice() != null) n++;
    if (this.mode() !== 'roundTrip') n++;
    return n;
  });

  constructor() {
    this.chartersService.getMeta().subscribe((m) => this.meta.set(m));
    this.load();
  }

  setMode(mode: PriceMode) {
    if (this.mode() === mode) return;
    this.mode.set(mode);
    this.load();
  }

  /** Adapter for app-segmented-toggle, which emits a plain string. */
  setModeValue(value: string) {
    this.setMode(value as PriceMode);
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

  setSortValue(value: string) {
    this.sort.set(value as 'price' | 'date');
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
