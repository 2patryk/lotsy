import { Component, inject, signal, computed, effect, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmInput } from '@spartan-ng/helm/input';
import { HlmSpinner } from '@spartan-ng/helm/spinner';
import {
  MultiSelectDropdownComponent,
  type MultiSelectOption,
} from '../../shared/filters/multi-select-dropdown.component';
import { DayPillsComponent } from '../../shared/filters/day-pills.component';
import { SortSelectComponent, type SortOption } from '../../shared/filters/sort-select.component';
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
  imports: [
    CommonModule,
    DealCardComponent,
    HlmButton,
    HlmInput,
    HlmSpinner,
    MultiSelectDropdownComponent,
    DayPillsComponent,
    SortSelectComponent,
  ],
  template: `
    <main class="mx-auto flex w-full max-w-[1100px] flex-col gap-5 px-3 py-7 sm:px-6">
      <div class="flex flex-col gap-1">
        <h1 class="text-2xl font-bold tracking-tight">Okazje weekendowe</h1>
        <p class="text-sm text-muted-foreground">
          Tanie loty z polskich lotnisk · 3–7 dni
          @if (lastUpdate()) {
            <span class="text-muted-foreground/70"> · Odświeżono: {{ lastUpdate() }}</span>
          }
        </p>
      </div>

      <!-- ── Filter card ───────────────────── -->
      <section class="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 shadow-xs">
        <!-- Row 1: dropdowns -->
        <div class="flex flex-wrap items-end gap-x-4 gap-y-3">
          <app-multi-select-dropdown
            label="Kraj"
            [options]="countryOptions"
            [selected]="selectedCountries()"
            placeholder="Wszystkie"
            [summary]="countrySummary"
            (toggled)="toggleCountry($event)"
          />

          <app-multi-select-dropdown
            label="Lotnisko wylotu"
            [options]="originOptions()"
            [selected]="selectedOrigins()"
            placeholder="Wszystkie lotniska"
            [summary]="originSummary"
            (toggled)="toggleOrigin($event)"
          />

          <app-multi-select-dropdown
            label="Typ połączenia"
            [options]="levelOptions"
            [selected]="selectedLevelStrings()"
            placeholder="Tam i z powrotem"
            [summary]="levelSummary"
            [active]="!(selectedLevels().length === 1 && selectedLevels()[0] === 1)"
            (toggled)="toggleLevel(+$event)"
          />

          <app-sort-select
            label="Sortuj"
            [options]="sortOptions"
            [value]="sortBy()"
            (changed)="setSort($event)"
          />
          @if (activeFilterCount() > 0) {
            <button hlmBtn variant="outline" size="sm" (click)="clearFilters()">
              Wyczyść ({{ activeFilterCount() }})
            </button>
          }
        </div>

        <!-- Row 2: sliders -->
        <div class="flex flex-wrap items-end gap-6 border-t border-border pt-4">
          <div class="flex w-full max-w-64 flex-col gap-1.5">
            <div class="flex items-center justify-between">
              <label class="text-xs font-medium text-muted-foreground">Maks. cena</label>
              <span class="text-sm font-bold">{{ maxPrice() }} PLN</span>
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
            <div class="flex justify-between text-[10px] text-muted-foreground">
              <span>200</span><span>{{ DEFAULT_MAX_PRICE }}</span>
            </div>
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-medium text-muted-foreground">Liczba nocy</label>
            <div class="flex items-center gap-2">
              <span class="text-[10px] font-bold tracking-wide text-muted-foreground uppercase"
                >od</span
              >
              <input
                hlmInput
                class="h-8 w-14 text-center tabular-nums"
                type="number"
                min="1"
                [max]="MAX_NIGHTS"
                [value]="minNights()"
                (change)="onMinNights($event)"
              />
              <span class="text-[10px] font-bold tracking-wide text-muted-foreground uppercase"
                >do</span
              >
              <input
                hlmInput
                class="h-8 w-14 text-center tabular-nums"
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
        <div class="flex flex-col gap-2 border-t border-border pt-4">
          <div
            class="flex items-center gap-3 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            <span
              class="w-12 shrink-0 text-[10px] font-bold tracking-wider text-muted-foreground uppercase"
              >Wylot</span
            >
            <div class="flex items-center gap-1">
              <app-day-pills [selected]="depDays()" (toggled)="toggleDay(depDays, $event)" />
              <div class="mx-1 h-5 w-px shrink-0 bg-border"></div>
              @for (t of TIMES; track t.id) {
                <button
                  hlmBtn
                  size="sm"
                  [variant]="depTimes().includes(t.id) ? 'default' : 'outline'"
                  class="h-9 shrink-0 flex-col gap-0 rounded-full px-2.5 text-xs leading-tight"
                  (click)="toggleTime(depTimes, t.id)"
                >
                  {{ t.label }}<span class="text-[9px] font-normal opacity-70">{{ t.sub }}</span>
                </button>
              }
            </div>
          </div>
          <div
            class="flex items-center gap-3 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            <span
              class="w-12 shrink-0 text-[10px] font-bold tracking-wider text-muted-foreground uppercase"
              >Powrót</span
            >
            <div class="flex items-center gap-1">
              <app-day-pills [selected]="retDays()" (toggled)="toggleDay(retDays, $event)" />
              <div class="mx-1 h-5 w-px shrink-0 bg-border"></div>
              @for (t of TIMES; track t.id) {
                <button
                  hlmBtn
                  size="sm"
                  [variant]="retTimes().includes(t.id) ? 'default' : 'outline'"
                  class="h-9 shrink-0 flex-col gap-0 rounded-full px-2.5 text-xs leading-tight"
                  (click)="toggleTime(retTimes, t.id)"
                >
                  {{ t.label }}<span class="text-[9px] font-normal opacity-70">{{ t.sub }}</span>
                </button>
              }
            </div>
          </div>
        </div>
      </section>

      <!-- ── Results ───────────────────────── -->
      @if (loading()) {
        <div class="flex items-center justify-center gap-3 py-16 text-sm text-muted-foreground">
          <hlm-spinner class="size-5" />
          <span>Wczytywanie ofert…</span>
        </div>
      } @else if (error()) {
        <div class="rounded-xl border border-border bg-card px-6 py-5 text-sm text-destructive">
          Nie udało się wczytać ofert. Spróbuj odświeżyć stronę.
        </div>
      } @else {
        <section class="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
          <div class="border-b border-border px-5 py-2.5">
            <span class="text-sm font-medium text-muted-foreground"
              >{{ allDeals().length }} {{ pluralize(allDeals().length) }}</span
            >
          </div>

          @if (allDeals().length === 0) {
            <div class="flex flex-col items-center gap-3 px-5 py-20 text-center">
              <div class="text-4xl text-muted-foreground/50">✈</div>
              <div class="font-semibold">Brak okazji dla tych filtrów</div>
              <div class="text-sm text-muted-foreground">Zmień kraj, lotnisko lub budżet</div>
              <button hlmBtn variant="outline" size="sm" (click)="clearFilters()">
                Wyczyść filtry
              </button>
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
              <div class="flex justify-center border-t border-border p-4">
                <button hlmBtn variant="outline" size="sm" (click)="loadMore()">
                  Pokaż więcej ({{ allDeals().length - visibleDeals().length }} pozostałych)
                </button>
              </div>
            }
          }
        </section>
      }

      <p class="text-center text-xs text-muted-foreground">
        Ceny w obie strony za osobę · Dostępność może się zmienić · „Sprawdź" prowadzi do aktualnej
        oferty na stronie linii lotniczej
      </p>
    </main>
  `,
  styles: [
    `
      /* Native range slider thumbs are not expressible with Tailwind utilities. */
      .range {
        -webkit-appearance: none;
        appearance: none;
        width: 100%;
        height: 4px;
        background: var(--border);
        border-radius: 2px;
        outline: none;
        cursor: pointer;
      }
      .range::-webkit-slider-thumb {
        -webkit-appearance: none;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: var(--primary);
        border: 2px solid var(--card);
        box-shadow: 0 1px 3px rgb(0 0 0 / 0.2);
        cursor: pointer;
      }
      .range::-moz-range-thumb {
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: var(--primary);
        border: 2px solid var(--card);
        cursor: pointer;
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

  savedCount = computed(() => this.savedService.savedDeals().length);

  // Shared filter-component wiring
  readonly countryOptions: MultiSelectOption[] = ALL_COUNTRIES.map((c) => ({
    value: c.code,
    label: c.name,
  }));
  originOptions = computed<MultiSelectOption[]>(() =>
    this.polishAirports().map((a) => ({ value: a.iata, label: `${a.name} (${a.iata})` })),
  );
  readonly levelOptions: MultiSelectOption[] = TRIP_LEVELS.map((t) => ({
    value: String(t.id),
    label: t.label,
  }));
  selectedLevelStrings = computed(() => this.selectedLevels().map(String));
  readonly sortOptions: SortOption[] = [
    { value: 'price', label: 'Cena rosnąco' },
    { value: 'departure', label: 'Data wylotu' },
    { value: 'duration', label: 'Liczba nocy' },
  ];
  readonly countrySummary = (sel: string[]) => `${sel.length} krajów`;
  readonly originSummary = (sel: string[]) => sel.join(', ');
  readonly levelSummary = (sel: string[]) =>
    sel.length === 1 && sel[0] === '1'
      ? 'Tam i z powrotem'
      : sel.length === 3
        ? 'Wszystkie typy'
        : `${sel.length} wybrane`;

  setSort(v: string) {
    this.sortBy.set(v as 'price' | 'departure' | 'duration');
  }

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
