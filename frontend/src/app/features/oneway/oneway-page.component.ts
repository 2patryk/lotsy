import {
  Component,
  inject,
  signal,
  computed,
  HostListener,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmBadge } from '@spartan-ng/helm/badge';
import { HlmInput } from '@spartan-ng/helm/input';
import { HlmSpinner } from '@spartan-ng/helm/spinner';
import { OneWayService } from '../../core/services/oneway.service';
import type { OneWayDirection, OneWayFare, OneWayMeta } from '../../core/models/oneway-fare.model';
import { SegmentedToggleComponent } from '../../shared/filters/segmented-toggle.component';
import { DayPillsComponent } from '../../shared/filters/day-pills.component';
import { FilterCardComponent } from '../../shared/filters/filter-card.component';
import { SortSelectComponent, type SortOption } from '../../shared/filters/sort-select.component';

const WD = ['ndz', 'pon', 'wt', 'śr', 'czw', 'pt', 'sob'];
const MON = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'];

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
  imports: [
    CommonModule,
    DecimalPipe,
    HlmButton,
    HlmBadge,
    HlmInput,
    HlmSpinner,
    SegmentedToggleComponent,
    DayPillsComponent,
    SortSelectComponent,
    FilterCardComponent,
  ],
  template: `
    <main class="mx-auto flex w-full max-w-[1100px] flex-col gap-5 px-3 py-7 sm:px-6">
      <div class="flex flex-col gap-1">
        <h1 class="text-2xl font-bold tracking-tight">Loty w jedną stronę</h1>
        <p class="text-sm text-muted-foreground">
          Bilety Ryanair bez przesiadek · cena za osobę
          @if (lastUpdate()) {
            <span class="text-muted-foreground/70"> · Odświeżono: {{ lastUpdate() }}</span>
          }
        </p>
      </div>

      <!-- ── Filters ─────────────────────────── -->
      <app-filter-card
        [filterCount]="filterCount()"
        [resultsCount]="fares().length"
        (cleared)="clearFilters()"
      >
        <div class="flex flex-wrap items-end gap-x-4 gap-y-3">
          <!-- Direction -->
          <app-segmented-toggle
            label="Kierunek"
            [options]="directionOptions"
            [value]="direction()"
            (changed)="setDirectionValue($event)"
          />

          <!-- PL airport autocomplete -->
          <div
            class="relative flex min-w-44 flex-1 flex-col gap-1.5"
            (click)="$event.stopPropagation()"
          >
            <label class="text-xs font-medium text-muted-foreground">Lotnisko polskie</label>
            <div
              class="flex min-h-8 w-full flex-wrap items-center gap-1 rounded-md border border-input bg-background px-2 py-1 text-sm transition-shadow focus-within:ring-[3px] focus-within:ring-ring/50"
              [class.border-primary]="selectedPlAirports().length > 0"
            >
              @if (selectedPlAirports().length) {
                @for (a of selectedPlAirports(); track a.iata) {
                  <span hlmBadge variant="secondary" class="gap-1 border-transparent pr-1">
                    {{ a.city }} ({{ a.iata }})
                    <button
                      type="button"
                      class="flex size-4 items-center justify-center rounded-full hover:bg-foreground/10"
                      (click)="removePlAirportItem(a)"
                      aria-label="Usuń"
                    >
                      ×
                    </button>
                  </span>
                }
              }
              <input
                #plAirportInputEl
                class="min-w-20 flex-1 border-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                type="text"
                placeholder="Miasto lub kod…"
                [value]="plAirportInput()"
                (input)="onPlAirportInput($event)"
                (focus)="onPlAirportFocus()"
                (keydown)="onPlAirportKeydown($event)"
              />
            </div>
            @if (plAirportPanelOpen() && plAirportSuggestions().length) {
              <div
                class="absolute top-full left-0 z-50 mt-1 max-h-64 w-full min-w-52 overflow-y-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md"
              >
                @for (a of plAirportSuggestions(); track a.iata; let i = $index) {
                  <div
                    class="flex cursor-pointer items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-sm"
                    [class.bg-accent]="i === plAirportHighlight()"
                    (mouseenter)="plAirportHighlight.set(i)"
                    (mousedown)="$event.preventDefault()"
                    (click)="selectPlAirportSuggestion(a)"
                  >
                    <span>{{ a.city }} ({{ a.iata }})</span>
                  </div>
                }
              </div>
            }
          </div>

          <!-- Country / city autocomplete -->
          <div
            class="relative flex min-w-44 flex-1 flex-col gap-1.5"
            (click)="$event.stopPropagation()"
          >
            <label class="text-xs font-medium text-muted-foreground">{{
              direction() === 'OUT' ? 'Dokąd' : 'Skąd'
            }}</label>
            <div
              class="flex min-h-8 w-full flex-wrap items-center gap-1 rounded-md border border-input bg-background px-2 py-1 text-sm transition-shadow focus-within:ring-[3px] focus-within:ring-ring/50"
              [class.border-primary]="hasDestSelection()"
            >
              @if (selectedDest().length) {
                @for (s of selectedDest(); track s.kind + '|' + s.name + '|' + (s.iata ?? '')) {
                  <span hlmBadge variant="secondary" class="gap-1 border-transparent pr-1">
                    {{ s.kind === 'airport' ? s.name + ' (' + s.iata + ')' : s.name }}
                    <button
                      type="button"
                      class="flex size-4 items-center justify-center rounded-full hover:bg-foreground/10"
                      (click)="removeDestItem(s)"
                      aria-label="Usuń"
                    >
                      ×
                    </button>
                  </span>
                }
              }
              <input
                #destInputEl
                class="min-w-20 flex-1 border-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                type="text"
                placeholder="Kraj lub miasto…"
                [value]="destInput()"
                (input)="onDestInput($event)"
                (focus)="onDestFocus()"
                (keydown)="onDestKeydown($event)"
              />
            </div>
            @if (destPanelOpen() && destSuggestions().length) {
              <div
                class="absolute top-full left-0 z-50 mt-1 max-h-64 w-full min-w-52 overflow-y-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md"
              >
                @for (
                  s of destSuggestions();
                  track s.kind + '|' + s.name + '|' + (s.iata ?? '');
                  let i = $index
                ) {
                  <div
                    class="flex cursor-pointer items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-sm"
                    [class.bg-accent]="i === destHighlight()"
                    (mouseenter)="destHighlight.set(i)"
                    (mousedown)="$event.preventDefault()"
                    (click)="selectDestSuggestion(s)"
                  >
                    <span>
                      {{ s.kind === 'airport' ? s.name + ' (' + s.iata + ')' : s.name }}
                      @if (s.kind === 'city' || s.kind === 'airport') {
                        <span class="text-muted-foreground">({{ s.country }})</span>
                      }
                    </span>
                    <span
                      hlmBadge
                      variant="outline"
                      class="shrink-0 font-normal text-muted-foreground"
                      >{{
                        s.kind === 'country' ? 'kraj' : s.kind === 'city' ? 'miasto' : 'lotnisko'
                      }}</span
                    >
                  </div>
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

        <!-- Row 2: day-of-week pills + price + sort + reset -->
        <div class="flex flex-wrap items-end gap-x-4 gap-y-3 border-t border-border pt-4">
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-medium text-muted-foreground">Dni tygodnia wylotu</label>
            <app-day-pills [selected]="selectedDaysArray()" (toggled)="toggleDay($event)" />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-medium text-muted-foreground">Maks. cena (zł)</label>
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
          {{ fares().length }} lotów
          @if (fares().length === 300) {
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
      } @else if (fares().length === 0) {
        <div
          class="flex flex-col items-center gap-3 rounded-xl border border-border bg-card px-5 py-20 text-center"
        >
          <div class="text-4xl text-muted-foreground/50">✈</div>
          <div class="font-semibold">Brak lotów dla wybranych filtrów</div>
          <div class="text-sm text-muted-foreground">Zmień kierunek, lotnisko lub daty</div>
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
          @for (f of fares(); track f.id) {
            <div
              class="grid grid-cols-[1fr_auto] items-center gap-3 px-3.5 py-3 transition-colors hover:bg-accent/40 sm:gap-6 sm:px-5 sm:py-3.5"
            >
              <!-- ── Left ─────────────────────── -->
              <div class="flex min-w-0 flex-col gap-2">
                <div class="flex flex-wrap items-center gap-1.5">
                  <span class="text-[15px] font-bold">{{ f.originCity }} → {{ f.destCity }}</span>
                  <span class="text-border max-sm:hidden">·</span>
                  <!-- Show the foreign-side country: destination when flying
                       out of Poland, origin when flying back in. -->
                  <span class="text-[13px] text-muted-foreground">{{
                    direction() === 'IN' ? f.originCountry : f.destCountry
                  }}</span>
                </div>

                <div class="flex flex-wrap items-center gap-1.5 text-[13px] sm:gap-2.5">
                  <span class="flex shrink-0 items-center gap-1.5">
                    <span class="text-xs text-muted-foreground">{{ fmtDate(f.date) }}</span>
                    <span class="text-sm font-bold tabular-nums">{{
                      fmtTime(f.departureTime)
                    }}</span>
                    <span class="font-semibold"
                      >{{ f.originCity }}
                      <span class="font-normal text-muted-foreground">({{ f.origin }})</span></span
                    >
                  </span>
                  <span class="flex flex-wrap items-center gap-1 max-sm:hidden">
                    <span class="mx-0.5 text-muted-foreground">→</span>
                    <strong class="font-semibold">{{ f.destCity }}</strong>
                    <span class="font-normal text-muted-foreground">({{ f.destination }})</span>
                    <span class="text-xs text-muted-foreground"
                      >przylot {{ fmtTime(f.arrivalTime) }}</span
                    >
                  </span>
                  @if (f.airline) {
                    <span
                      hlmBadge
                      variant="secondary"
                      [class]="
                        'gap-1 border-transparent font-medium' +
                        (f.source === 'WIZZAIR' ? ' bg-[#e6007e]/10 text-[#c6007e]' : '')
                      "
                      >{{ f.airline }}
                      @if (f.flightNumber) {
                        <span class="font-normal opacity-70">{{ f.flightNumber }}</span>
                      }
                    </span>
                  }
                </div>
              </div>

              <!-- ── Right ────────────────────── -->
              <div class="flex shrink-0 flex-col items-end gap-2.5">
                <div class="text-right">
                  <div
                    class="text-xl leading-tight font-extrabold whitespace-nowrap tabular-nums sm:text-2xl"
                  >
                    {{ f.price | number: '1.0-0' }}
                    <span class="text-sm font-medium text-muted-foreground">{{ f.currency }}</span>
                  </div>
                  <div class="text-[11px] text-muted-foreground">w jedną stronę</div>
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
})
export class OneWayPageComponent {
  private oneWayService = inject(OneWayService);

  @ViewChild('destInputEl') destInputEl?: ElementRef<HTMLInputElement>;
  @ViewChild('plAirportInputEl') plAirportInputEl?: ElementRef<HTMLInputElement>;

  readonly directionOptions = [
    { value: 'OUT', label: 'Z Polski' },
    { value: 'IN', label: 'Do Polski' },
  ];
  readonly sortOptions: SortOption[] = [
    { value: 'price', label: 'Najtańsze najpierw' },
    { value: 'date', label: 'Data wylotu' },
  ];

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

  // Array form of selectedDays for app-day-pills, which takes number[] rather than a Set.
  selectedDaysArray = computed(() => [...this.selectedDays()]);

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
  }

  @HostListener('document:click')
  closeDropdowns() {
    this.destPanelOpen.set(false);
    this.plAirportPanelOpen.set(false);
  }

  // app-segmented-toggle emits a plain string; narrow it to the direction union here.
  setDirectionValue(value: string) {
    this.setDirection(value as OneWayDirection);
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

  // app-sort-select emits a plain string; narrow it to the sort union here.
  setSortValue(value: string) {
    this.sort.set(value as 'price' | 'date');
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
    const dateOut = f.date.slice(0, 10);

    if (f.source === 'WIZZAIR') {
      // Path-based deep link: /select-flight/{dep}/{arr}/{out}/{ret}/{adt}/{chd}/{inf}/null.
      // The query-param form only opens the booking page without prefilling the flight.
      return `https://wizzair.com/pl-pl/booking/select-flight/${f.origin}/${f.destination}/${dateOut}/null/1/0/0/null`;
    }

    const params = new URLSearchParams({
      adults: '1',
      teens: '0',
      children: '0',
      infants: '0',
      dateOut,
      isReturn: 'false',
      originIata: f.origin,
      destinationIata: f.destination,
    });
    return `https://www.ryanair.com/pl/pl/trip/flights/select?${params}`;
  }
}
