import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import type { Subscription } from 'rxjs';
import { HlmBadge } from '@spartan-ng/helm/badge';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmInput } from '@spartan-ng/helm/input';
import { HlmSpinner } from '@spartan-ng/helm/spinner';
import { OneWayService } from '../../core/services/oneway.service';
import type { OneWayFare, OnwardFlight, OnwardMode } from '../../core/models/oneway-fare.model';
import { normalize } from '../../shared/text';

const WD = ['ndz', 'pon', 'wt', 'śr', 'czw', 'pt', 'sob'];
const MON = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'];

// Minimum connection buffer between the clicked fare and an onward flight.
const MIN_TRANSFER_MS = 2 * 60 * 60 * 1000;

interface DayOption {
  date: string; // YYYY-MM-DD
  label: string; // "śr 15 lip"
}

function addDays(day: string, days: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function dayLabel(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  return `${WD[d.getUTCDay()]} ${d.getUTCDate()} ${MON[d.getUTCMonth()]}`;
}

/**
 * Live onward-connections panel under a one-way fare row.
 * OUT fares: departures from the arrival airport ≥2h after landing, on the
 * arrival day or up to 7 days later. IN fares: the mirror image — arrivals
 * into the departure airport ≥2h before takeoff, same day or up to 7 days
 * earlier. Ryanair renders immediately; Wizz (slow per-route fan-out on the
 * API side) streams in and the merged list re-sorts by price.
 */
@Component({
  selector: 'app-onward-panel',
  standalone: true,
  imports: [CommonModule, DecimalPipe, HlmBadge, HlmButton, HlmInput, HlmSpinner],
  template: `
    <div class="flex flex-col gap-3 border-t border-border bg-accent/20 px-3.5 py-4 sm:px-5">
      <div class="flex flex-col gap-0.5">
        <span class="text-sm font-semibold">
          @if (mode() === 'departures') {
            Loty dalej z: {{ airportCity() }} ({{ airport() }})
          } @else {
            Loty do: {{ airportCity() }} ({{ airport() }}) przed wylotem
          }
        </span>
        <span class="text-xs text-muted-foreground">
          @if (isBaseDay()) {
            @if (mode() === 'departures') {
              wylot min. 2 h po przylocie ({{ fmtTime(fare().arrivalTime) }})
            } @else {
              przylot min. 2 h przed wylotem ({{ fmtTime(fare().departureTime) }})
            }
          } @else {
            Ryanair + Wizz Air + inne linie · ceny w PLN za osobę
          }
        </span>
      </div>

      <!-- Day selector: base day … ±7, plus a text filter over fetched results -->
      <div class="flex flex-wrap items-center gap-1">
        @for (d of days(); track d.date) {
          <button
            hlmBtn
            size="sm"
            [variant]="selectedDate() === d.date ? 'default' : 'outline'"
            class="h-7 shrink-0 rounded-full px-2.5 text-xs"
            (click)="selectDay(d.date)"
          >
            {{ d.label }}
          </button>
        }
        <input
          hlmInput
          class="h-7 w-40 text-xs sm:ml-auto"
          type="text"
          [placeholder]="
            mode() === 'departures' ? 'Dokąd? Kraj lub miasto…' : 'Skąd? Kraj lub miasto…'
          "
          [value]="searchQuery()"
          (input)="onSearchInput($event)"
          (click)="$event.stopPropagation()"
        />
      </div>

      <!-- Google Flights is fetched only on demand (unofficial API, can be
           flaky/slow) — one button per selected day. -->
      <div class="flex flex-wrap items-center gap-2">
        @if (loadingSources().length) {
          <div class="flex items-center gap-2 text-xs text-muted-foreground">
            <hlm-spinner class="size-3.5" />
            <span>Dociągam: {{ loadingSources().join(', ') }}…</span>
          </div>
        }
        @if (!googleLoading() && !googleLoaded()) {
          <button
            hlmBtn
            variant="outline"
            size="sm"
            class="h-7 px-2.5 text-xs"
            (click)="loadGoogle()"
          >
            {{
              googleError()
                ? 'Inne linie — spróbuj ponownie'
                : 'Szukaj innych linii (easyJet, Vueling…)'
            }}
          </button>
          @if (googleError()) {
            <span class="text-xs text-destructive">Nie udało się pobrać innych linii.</span>
          }
        }
        @if (googleLoaded() && !googleFlights().length) {
          <span class="text-xs text-muted-foreground">Inne linie: brak lotów tego dnia.</span>
        }
      </div>

      @if (ryanLoading() && !flights().length) {
        <div class="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <hlm-spinner class="size-4" />
          <span>Szukam połączeń…</span>
        </div>
      } @else if (ryanError() && wizzError()) {
        <div class="py-3 text-sm text-destructive">
          Nie udało się pobrać połączeń. Spróbuj ponownie później.
        </div>
      } @else if (!flights().length && !anyLoading()) {
        <div class="py-3 text-sm text-muted-foreground">
          @if (searchQuery().trim()) {
            Brak połączeń dla „{{ searchQuery() }}" tego dnia.
          } @else {
            Brak połączeń tego dnia{{ isBaseDay() ? ' (min. 2 h na przesiadkę)' : '' }}.
          }
        </div>
      } @else {
        <div
          class="divide-y divide-border/70 overflow-hidden rounded-lg border border-border bg-card"
        >
          @for (f of flights(); track trackFlight(f)) {
            <div class="grid grid-cols-[1fr_auto] items-center gap-3 px-3 py-2.5">
              <div class="flex min-w-0 flex-col gap-1">
                <div class="flex flex-wrap items-center gap-1.5 text-[13px]">
                  <span class="text-sm font-bold tabular-nums">{{ fmtTime(f.departureTime) }}</span>
                  <span class="font-semibold">
                    {{ f.originCity }}
                    <span class="font-normal text-muted-foreground">({{ f.origin }})</span>
                  </span>
                  <span class="text-muted-foreground">→</span>
                  <span class="font-semibold">
                    {{ f.destCity }}
                    <span class="font-normal text-muted-foreground">({{ f.destination }})</span>
                  </span>
                  <span class="text-xs text-muted-foreground"
                    >przylot {{ fmtTime(f.arrivalTime) }}</span
                  >
                </div>
                <div class="flex items-center gap-1.5">
                  <span
                    hlmBadge
                    variant="secondary"
                    [class]="
                      'gap-1 border-transparent text-[11px] font-medium' +
                      (f.source === 'WIZZAIR'
                        ? ' bg-[#e6007e]/10 text-[#c6007e]'
                        : f.source === 'RAINBOW'
                          ? ' bg-amber-500/15 text-amber-700'
                          : '')
                    "
                    >{{ f.source === 'RAINBOW' ? 'Czarter · ' + f.airline : f.airline }}
                    @if (f.flightNumber) {
                      <span class="font-normal opacity-70">{{ f.flightNumber }}</span>
                    }
                  </span>
                </div>
              </div>
              <div class="flex shrink-0 items-center gap-3">
                <span class="text-base font-extrabold whitespace-nowrap tabular-nums">
                  {{ f.price | number: '1.0-0' }}
                  <span class="text-xs font-medium text-muted-foreground">zł</span>
                </span>
                <a
                  hlmBtn
                  variant="outline"
                  size="sm"
                  class="h-7 px-2.5 text-xs"
                  [href]="bookingUrl(f)"
                  target="_blank"
                  rel="noopener"
                  (click)="$event.stopPropagation()"
                  >Sprawdź</a
                >
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class OnwardPanelComponent {
  private oneWayService = inject(OneWayService);

  fare = input.required<OneWayFare>();

  // OUT fare → onward departures from where it lands; IN fare → feeder
  // arrivals into where it takes off.
  mode = computed<OnwardMode>(() => (this.fare().direction === 'IN' ? 'arrivals' : 'departures'));
  airport = computed(() =>
    this.mode() === 'departures' ? this.fare().destination : this.fare().origin,
  );
  airportCity = computed(() =>
    this.mode() === 'departures' ? this.fare().destCity : this.fare().originCity,
  );
  private baseDate = computed(() => this.fare().date.slice(0, 10));
  // Arrivals count backwards from the fare's day; skip days already in the past.
  days = computed<DayOption[]>(() => {
    const base = this.baseDate();
    const today = new Date().toISOString().slice(0, 10);
    const step = this.mode() === 'departures' ? 1 : -1;
    const out: DayOption[] = [];
    for (let i = 0; i < 8; i++) {
      const date = addDays(base, i * step);
      if (date < today) break;
      out.push({ date, label: dayLabel(date) });
    }
    return out;
  });
  private windowStart = computed(() =>
    this.mode() === 'departures' ? this.baseDate() : addDays(this.baseDate(), -7),
  );

  selectedDate = signal('');
  isBaseDay = computed(() => this.selectedDate() === this.baseDate());

  ryanFlights = signal<OnwardFlight[]>([]);
  wizzFlights = signal<OnwardFlight[]>([]);
  googleFlights = signal<OnwardFlight[]>([]);
  ryanLoading = signal(false);
  wizzLoading = signal(false);
  googleLoading = signal(false);
  ryanError = signal(false);
  wizzError = signal(false);
  googleError = signal(false);
  // Google results delivered for the currently selected day (opt-in fetch).
  googleLoaded = signal(false);

  private ryanSub?: Subscription;
  private wizzSub?: Subscription;
  private googleSub?: Subscription;

  // Slow sources still being fetched while Ryanair results already render.
  loadingSources = computed(() => {
    const out: string[] = [];
    if (this.wizzLoading()) out.push('Wizz Air');
    if (this.googleLoading()) out.push('inne linie (Google Flights)');
    return out;
  });
  anyLoading = computed(() => this.ryanLoading() || this.wizzLoading() || this.googleLoading());

  // Text filter over the fetched list, matching the varying end of each
  // flight (destination for departures, origin for arrivals) by city or
  // country. Kept across day switches.
  searchQuery = signal('');
  // Wizz/Google rows carry ISO country codes; translate for matching "hiszpania".
  private regionNames = new Intl.DisplayNames(['pl'], { type: 'region' });

  private matchesQuery(x: OnwardFlight, q: string): boolean {
    const [city, country] =
      this.mode() === 'departures' ? [x.destCity, x.destCountry] : [x.originCity, x.originCountry];
    let countryFull = country;
    if (/^[A-Z]{2}$/.test(country)) {
      try {
        countryFull = this.regionNames.of(country) ?? country;
      } catch {
        /* keep the raw code */
      }
    }
    return (
      normalize(city).includes(q) ||
      normalize(country).includes(q) ||
      normalize(countryFull).includes(q)
    );
  }

  // Merged, price-sorted list with the 2h transfer buffer applied on the
  // fare's own day (other days need no time constraint).
  flights = computed<OnwardFlight[]>(() => {
    let all = [...this.ryanFlights(), ...this.wizzFlights(), ...this.googleFlights()];
    if (this.isBaseDay()) {
      const f = this.fare();
      all =
        this.mode() === 'departures'
          ? all.filter(
              (x) =>
                new Date(x.departureTime).getTime() >=
                new Date(f.arrivalTime).getTime() + MIN_TRANSFER_MS,
            )
          : all.filter(
              (x) =>
                new Date(x.arrivalTime).getTime() <=
                new Date(f.departureTime).getTime() - MIN_TRANSFER_MS,
            );
    }
    // Leading '!' inverts the filter ("wszystko oprócz").
    const raw = this.searchQuery().trim();
    const negated = raw.startsWith('!');
    const q = normalize(negated ? raw.slice(1) : raw);
    if (q) all = all.filter((x) => this.matchesQuery(x, q) !== negated);
    return all.sort((a, b) => a.price - b.price);
  });

  constructor() {
    // Reload whenever the fare (and thus airport/day window) changes.
    effect(() => {
      const first = this.days()[0]?.date;
      if (first) {
        this.selectedDate.set(first);
        this.load(first);
      }
    });
  }

  selectDay(date: string) {
    if (this.selectedDate() === date) return;
    this.selectedDate.set(date);
    this.load(date);
  }

  onSearchInput(e: Event) {
    this.searchQuery.set((e.target as HTMLInputElement).value);
  }

  private load(date: string) {
    const base = {
      airport: this.airport(),
      date,
      mode: this.mode(),
      windowStart: this.windowStart(),
    } as const;

    this.ryanSub?.unsubscribe();
    this.ryanLoading.set(true);
    this.ryanError.set(false);
    this.ryanFlights.set([]);
    this.ryanSub = this.oneWayService.getOnward({ ...base, carrier: 'ryanair' }).subscribe({
      next: (flights) => {
        this.ryanFlights.set(flights);
        this.ryanLoading.set(false);
      },
      error: () => {
        this.ryanError.set(true);
        this.ryanLoading.set(false);
      },
    });

    this.wizzSub?.unsubscribe();
    this.wizzLoading.set(true);
    this.wizzError.set(false);
    this.wizzFlights.set([]);
    this.wizzSub = this.oneWayService.getOnward({ ...base, carrier: 'wizz' }).subscribe({
      next: (flights) => {
        this.wizzFlights.set(flights);
        this.wizzLoading.set(false);
      },
      error: () => {
        this.wizzError.set(true);
        this.wizzLoading.set(false);
      },
    });

    // Google is opt-in per day — just reset whatever the previous day loaded.
    this.googleSub?.unsubscribe();
    this.googleLoading.set(false);
    this.googleError.set(false);
    this.googleLoaded.set(false);
    this.googleFlights.set([]);
  }

  loadGoogle() {
    this.googleSub?.unsubscribe();
    this.googleLoading.set(true);
    this.googleError.set(false);
    this.googleSub = this.oneWayService
      .getOnward({
        airport: this.airport(),
        date: this.selectedDate(),
        mode: this.mode(),
        windowStart: this.windowStart(),
        carrier: 'google',
      })
      .subscribe({
        next: (flights) => {
          this.googleFlights.set(flights);
          this.googleLoaded.set(true);
          this.googleLoading.set(false);
        },
        error: () => {
          this.googleError.set(true);
          this.googleLoading.set(false);
        },
      });
  }

  trackFlight(f: OnwardFlight): string {
    return `${f.source}:${f.origin}:${f.destination}:${f.departureTime}`;
  }

  fmtTime(iso: string): string {
    const d = new Date(iso);
    const hh = String(d.getUTCHours()).padStart(2, '0');
    const mm = String(d.getUTCMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  }

  bookingUrl(f: OnwardFlight): string {
    if (f.source === 'RAINBOW' && f.charter) {
      // Same deep-link pattern as the charters tab.
      const qs = new URLSearchParams({ oneWay: 'true', data: f.date });
      if (f.charter.pakietId) qs.set('idWylot', f.charter.pakietId);
      return `https://r.pl/bilety-czarterowe/${f.charter.destCountryUrl}/${f.charter.destNameUrl}?${qs}`;
    }
    if (f.source === 'GOOGLE') {
      // Other carriers have no uniform deep link — hand off to Google Flights.
      const q = `Flights from ${f.origin} to ${f.destination} on ${f.date}`;
      return `https://www.google.com/travel/flights?q=${encodeURIComponent(q)}&curr=PLN&hl=pl`;
    }
    if (f.source === 'WIZZAIR') {
      return `https://wizzair.com/pl-pl/booking/select-flight/${f.origin}/${f.destination}/${f.date}/null/1/0/0/null`;
    }
    const params = new URLSearchParams({
      adults: '1',
      teens: '0',
      children: '0',
      infants: '0',
      dateOut: f.date,
      isReturn: 'false',
      originIata: f.origin,
      destinationIata: f.destination,
    });
    return `https://www.ryanair.com/pl/pl/trip/flights/select?${params}`;
  }
}
