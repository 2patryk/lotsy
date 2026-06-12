import { Component, inject, signal, computed, effect, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatSliderModule } from '@angular/material/slider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatBadgeModule } from '@angular/material/badge';
import { toObservable, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { switchMap, tap } from 'rxjs';
import { DealCardComponent } from './deal-card.component';
import { DealsService, type DealsQueryParams } from '../../core/services/deals.service';
import { SavedDealsService } from '../../core/services/saved-deals.service';
import type { Deal } from '../../core/models/deal.model';

const ALL_COUNTRIES: { code: string; name: string; flag: string }[] = [
  { code: 'AL', name: 'Albania',         flag: '🇦🇱' },
  { code: 'BA', name: 'Bośnia',          flag: '🇧🇦' },
  { code: 'BG', name: 'Bułgaria',        flag: '🇧🇬' },
  { code: 'ME', name: 'Czarnogóra',      flag: '🇲🇪' },
  { code: 'FR', name: 'Francja',         flag: '🇫🇷' },
  { code: 'GR', name: 'Grecja',          flag: '🇬🇷' },
  { code: 'ES', name: 'Hiszpania',       flag: '🇪🇸' },
  { code: 'IE', name: 'Irlandia',        flag: '🇮🇪' },
  { code: 'IS', name: 'Islandia',        flag: '🇮🇸' },
  { code: 'IL', name: 'Izrael',          flag: '🇮🇱' },
  { code: 'JO', name: 'Jordania',        flag: '🇯🇴' },
  { code: 'XK', name: 'Kosowo',          flag: '🇽🇰' },
  { code: 'MK', name: 'Macedonia',       flag: '🇲🇰' },
  { code: 'MT', name: 'Malta',           flag: '🇲🇹' },
  { code: 'MA', name: 'Maroko',          flag: '🇲🇦' },
  { code: 'IT', name: 'Włochy',          flag: '🇮🇹' },
  { code: 'PT', name: 'Portugalia',      flag: '🇵🇹' },
  { code: 'RO', name: 'Rumunia',         flag: '🇷🇴' },
  { code: 'RS', name: 'Serbia',          flag: '🇷🇸' },
  { code: 'TN', name: 'Tunezja',         flag: '🇹🇳' },
  { code: 'TR', name: 'Turcja',          flag: '🇹🇷' },
  { code: 'GB', name: 'Wielka Brytania', flag: '🇬🇧' },
  { code: 'HR', name: 'Chorwacja',       flag: '🇭🇷' },
  { code: 'CY', name: 'Cypr',            flag: '🇨🇾' },
].sort((a, b) => a.name.localeCompare(b.name, 'pl'));

const AIRPORT_NAMES: Record<string, string> = {
  WAW: 'Warszawa Chopin (WAW)', WMI: 'Warszawa Modlin (WMI)',
  KTW: 'Katowice (KTW)', KRK: 'Kraków (KRK)', GDN: 'Gdańsk (GDN)',
  WRO: 'Wrocław (WRO)', POZ: 'Poznań (POZ)', LCJ: 'Łódź (LCJ)',
};

const DEFAULT_MAX_PRICE = 800;

@Component({
  selector: 'app-deals-page',
  standalone: true,
  imports: [
    CommonModule, RouterLink,
    MatToolbarModule, MatButtonModule, MatIconModule,
    MatSelectModule, MatSliderModule, MatProgressSpinnerModule,
    MatFormFieldModule, MatBadgeModule,
    DealCardComponent,
  ],
  template: `
    <mat-toolbar color="primary" class="app-toolbar">
      <span class="logo">Lotsy ✈️</span>
      <span class="toolbar-spacer"></span>
      <a mat-button [routerLink]="['/deals/saved']" class="saved-link">
        <mat-icon [matBadge]="savedCount() || null" matBadgeColor="accent">favorite</mat-icon>
        Zapisane
      </a>
    </mat-toolbar>

    <div class="page-container">
      <div class="filters-bar">
        <mat-form-field appearance="outline" class="filter-field">
          <mat-label>Kraj</mat-label>
          <mat-select multiple [value]="selectedCountries()" (valueChange)="selectedCountries.set($event)">
            @for (c of availableCountries; track c.code) {
              <mat-option [value]="c.code">{{ c.flag }} {{ c.name }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline" class="filter-field">
          <mat-label>Lotnisko wylotu</mat-label>
          <mat-select multiple [value]="selectedOrigins()" (valueChange)="selectedOrigins.set($event)">
            @for (ap of availableOrigins(); track ap) {
              <mat-option [value]="ap">{{ airportName(ap) }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        <div class="price-filter">
          <label class="price-label">Maks. cena: <strong>{{ maxPrice() }} zł</strong></label>
          <mat-slider min="200" [max]="DEFAULT_MAX_PRICE" step="50" class="price-slider">
            <input matSliderThumb [value]="maxPrice()" (valueChange)="maxPrice.set($event)" />
          </mat-slider>
        </div>

        <div class="price-filter">
          <label class="price-label">Liczba nocy: <strong>{{ minNights() }}–{{ maxNights() }}</strong></label>
          <mat-slider min="1" max="7" step="1" class="price-slider">
            <input matSliderStartThumb [value]="minNights()" (valueChange)="minNights.set($event)" />
            <input matSliderEndThumb   [value]="maxNights()" (valueChange)="maxNights.set($event)" />
          </mat-slider>
        </div>

        <mat-form-field appearance="outline" class="filter-field sort-field">
          <mat-label>Sortuj</mat-label>
          <mat-select [value]="sortBy()" (valueChange)="sortBy.set($event)">
            <mat-option value="price">Cena rosnąco</mat-option>
            <mat-option value="departure">Data wylotu</mat-option>
            <mat-option value="duration">Liczba nocy</mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline" class="filter-field sort-field">
          <mat-label>Typ połączenia</mat-label>
          <mat-select multiple [value]="selectedLevels()" (valueChange)="selectedLevels.set($event)">
            <mat-option [value]="1">↩ Tam i z powrotem</mat-option>
            <mat-option [value]="2">↔ Bliskie lotniska (WAW↔WMI, KRK↔KTW)</mat-option>
            <mat-option [value]="3">✈→✈ Open-jaw (różne miasta)</mat-option>
          </mat-select>
        </mat-form-field>

        @if (activeFilterCount() > 0) {
          <button mat-button color="warn" (click)="clearFilters()">
            <mat-icon>clear</mat-icon> Wyczyść ({{ activeFilterCount() }})
          </button>
        }
      </div>

      @if (loading()) {
        <div class="loading-center">
          <mat-spinner diameter="48"></mat-spinner>
          <p>Wczytywanie ofert…</p>
        </div>
      } @else if (error()) {
        <div class="error-box">
          <mat-icon>error_outline</mat-icon>
          <p>Nie udało się wczytać ofert. Spróbuj odświeżyć stronę.</p>
        </div>
      } @else {
        <div class="results-header">
          <span class="results-count">{{ allDeals().length }} ofert</span>
          @if (lastUpdate()) {
            <span class="last-update">Ostatnia aktualizacja: {{ lastUpdate() }}</span>
          }
        </div>

        @if (allDeals().length === 0) {
          <div class="empty-state">
            <mat-icon>search_off</mat-icon>
            <p>Brak ofert dla wybranych filtrów. Spróbuj zmienić kryteria.</p>
          </div>
        } @else {
          <div class="deals-grid">
            @for (deal of visibleDeals(); track deal.id) {
              <app-deal-card [deal]="deal" />
            }
          </div>

          @if (visibleDeals().length < allDeals().length) {
            <div class="load-more">
              <button mat-stroked-button (click)="loadMore()">
                Pokaż więcej ({{ allDeals().length - visibleDeals().length }} pozostałych)
              </button>
            </div>
          }
        }
      }
    </div>
  `,
  styles: [`
    .app-toolbar { position: sticky; top: 0; z-index: 100; }
    .logo { font-size: 1.3rem; font-weight: 700; letter-spacing: -0.02em; }
    .toolbar-spacer { flex: 1; }
    .saved-link { gap: 4px; }

    .page-container { max-width: 1200px; margin: 0 auto; padding: 16px; }

    .filters-bar {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: center;
      margin-bottom: 16px;
      padding: 16px;
      background: white;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    }
    .filter-field { min-width: 200px; }
    .sort-field { min-width: 160px; }

    .price-filter {
      display: flex;
      flex-direction: column;
      min-width: 200px;
    }
    .price-label { font-size: 0.85rem; color: #555; margin-bottom: -8px; }
    .price-slider { width: 100%; }

    .results-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
      padding: 0 4px;
    }
    .results-count { font-weight: 600; color: #333; }
    .last-update { font-size: 0.8rem; color: #888; }

    .deals-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 16px;
    }

    .loading-center, .empty-state, .error-box {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      padding: 60px 20px;
      color: #888;
    }
    .error-box { color: #c62828; }
    .empty-state mat-icon, .error-box mat-icon { font-size: 48px; height: 48px; width: 48px; }

    .load-more { display: flex; justify-content: center; margin-top: 24px; }
  `],
})
export class DealsPageComponent implements OnInit {
  private dealsService = inject(DealsService);
  private savedService = inject(SavedDealsService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  readonly DEFAULT_MAX_PRICE = DEFAULT_MAX_PRICE;
  readonly availableCountries = ALL_COUNTRIES;

  loading = signal(true);
  error = signal(false);
  allDeals = signal<Deal[]>([]);
  lastUpdate = signal<string | null>(null);

  selectedCountries = signal<string[]>([]);
  selectedOrigins = signal<string[]>([]);
  maxPrice = signal(DEFAULT_MAX_PRICE);
  sortBy = signal<'price' | 'departure' | 'duration'>('price');
  selectedLevels = signal<number[]>([1, 2, 3]);
  minNights = signal(1);
  maxNights = signal(7);
  visibleCount = signal(24);

  savedCount = computed(() => this.savedService.savedDeals().length);

  availableOrigins = computed(() => {
    const codes = new Set(this.allDeals().map((d) => d.originAirport));
    return [...codes].sort();
  });

  visibleDeals = computed(() => this.allDeals().slice(0, this.visibleCount()));

  activeFilterCount = computed(() => {
    let n = 0;
    if (this.selectedCountries().length > 0) n++;
    if (this.selectedOrigins().length > 0) n++;
    if (this.maxPrice() < DEFAULT_MAX_PRICE) n++;
    if (this.selectedLevels().length < 3) n++;
    if (this.minNights() > 1 || this.maxNights() < 7) n++;
    return n;
  });

  private query = computed<DealsQueryParams>(() => ({
    destCountry: this.selectedCountries().join(',') || undefined,
    maxPrice: this.maxPrice(),
    origin: this.selectedOrigins().join(',') || undefined,
    sort: this.sortBy(),
    levels: this.selectedLevels().length < 3 ? [...this.selectedLevels()].sort().join(',') : undefined,
    minNights: this.minNights() > 1 ? this.minNights() : undefined,
    maxNights: this.maxNights() < 7 ? this.maxNights() : undefined,
  }));

  constructor() {
    // Initialize signals from URL query params
    const params = this.route.snapshot.queryParams;
    if (params['countries']) this.selectedCountries.set(params['countries'].split(','));
    if (params['origins'])   this.selectedOrigins.set(params['origins'].split(','));
    if (params['maxPrice'])  this.maxPrice.set(Number(params['maxPrice']));
    if (params['sort'])      this.sortBy.set(params['sort']);
    if (params['levels'])    this.selectedLevels.set(params['levels'].split(',').map(Number));
    if (params['minNights']) this.minNights.set(Number(params['minNights']));
    if (params['maxNights']) this.maxNights.set(Number(params['maxNights']));

    // Re-fetch when any filter changes
    toObservable(this.query).pipe(
      tap(() => { this.loading.set(true); this.error.set(false); this.visibleCount.set(24); }),
      switchMap((q) => this.dealsService.getDeals(q)),
      takeUntilDestroyed(),
    ).subscribe({
      next: (deals) => { this.allDeals.set(deals); this.loading.set(false); },
      error: () => { this.error.set(true); this.loading.set(false); },
    });

    // Sync filter state back to URL
    effect(() => {
      const countries = this.selectedCountries();
      const origins = this.selectedOrigins();
      const maxPrice = this.maxPrice();
      const sort = this.sortBy();
      const levels = this.selectedLevels();
      this.router.navigate([], {
        relativeTo: this.route,
        replaceUrl: true,
        queryParams: {
          countries: countries.length ? countries.join(',') : null,
          origins:   origins.length   ? origins.join(',')   : null,
          maxPrice:  maxPrice < DEFAULT_MAX_PRICE ? maxPrice : null,
          sort:      sort !== 'price' ? sort : null,
          levels:    levels.length < 3 ? [...levels].sort().join(',') : null,
          minNights: this.minNights() > 1 ? this.minNights() : null,
          maxNights: this.maxNights() < 7 ? this.maxNights() : null,
        },
      });
    });
  }

  ngOnInit() {
    this.dealsService.getHealth().subscribe({
      next: (h) => {
        if (h.lastSuccessfulRun) {
          const diff = Date.now() - new Date(h.lastSuccessfulRun).getTime();
          const mins = Math.round(diff / 60000);
          this.lastUpdate.set(mins < 60 ? `${mins} min temu` : `${Math.round(mins / 60)} h temu`);
        }
      },
      error: () => {},
    });
  }

  loadMore() {
    this.visibleCount.update((n) => n + 24);
  }

  clearFilters() {
    this.selectedCountries.set([]);
    this.selectedOrigins.set([]);
    this.maxPrice.set(DEFAULT_MAX_PRICE);
    this.sortBy.set('price');
    this.selectedLevels.set([1, 2, 3]);
    this.minNights.set(1);
    this.maxNights.set(7);
    this.visibleCount.set(24);
  }

  airportName(code: string): string {
    return AIRPORT_NAMES[code] ?? code;
  }
}
