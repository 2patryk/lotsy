import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatSliderModule } from '@angular/material/slider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatBadgeModule } from '@angular/material/badge';
import { DealCardComponent } from './deal-card.component';
import { DealsService } from '../../core/services/deals.service';
import { SavedDealsService } from '../../core/services/saved-deals.service';
import type { Deal } from '../../core/models/deal.model';

const COUNTRY_NAMES: Record<string, string> = {
  IT: 'Włochy', ES: 'Hiszpania', GR: 'Grecja', HR: 'Chorwacja',
  PT: 'Portugalia', MT: 'Malta', CY: 'Cypr', TR: 'Turcja',
  BG: 'Bułgaria', FR: 'Francja', AL: 'Albania', ME: 'Czarnogóra',
};

const AIRPORT_NAMES: Record<string, string> = {
  WAW: 'Warszawa Chopin (WAW)', WMI: 'Warszawa Modlin (WMI)',
  KTW: 'Katowice (KTW)', KRK: 'Kraków (KRK)', GDN: 'Gdańsk (GDN)',
  WRO: 'Wrocław (WRO)', POZ: 'Poznań (POZ)', LCJ: 'Łódź (LCJ)',
};

@Component({
  selector: 'app-deals-page',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterLink,
    MatToolbarModule, MatButtonModule, MatIconModule,
    MatSelectModule, MatSliderModule, MatProgressSpinnerModule,
    MatChipsModule, MatFormFieldModule, MatBadgeModule,
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
          <mat-select multiple [(ngModel)]="selectedCountries">
            @for (c of availableCountries(); track c.code) {
              <mat-option [value]="c.code">{{ c.flag }} {{ c.name }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline" class="filter-field">
          <mat-label>Lotnisko wylotu</mat-label>
          <mat-select multiple [(ngModel)]="selectedOrigins">
            @for (ap of availableOrigins(); track ap) {
              <mat-option [value]="ap">{{ airportName(ap) }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        <div class="price-filter">
          <label class="price-label">Maks. cena: <strong>{{ maxPrice() }} zł</strong></label>
          <mat-slider min="200" max="1500" step="50" class="price-slider">
            <input matSliderThumb [(ngModel)]="maxPriceValue" />
          </mat-slider>
        </div>

        <mat-form-field appearance="outline" class="filter-field sort-field">
          <mat-label>Sortuj</mat-label>
          <mat-select [(ngModel)]="sortBy">
            <mat-option value="price">Cena rosnąco</mat-option>
            <mat-option value="departure">Data wylotu</mat-option>
            <mat-option value="duration">Liczba nocy</mat-option>
          </mat-select>
        </mat-form-field>

        @if (activeFilterCount() > 0) {
          <button mat-button color="warn" (click)="clearFilters()">
            <mat-icon>clear</mat-icon> Wyczyść filtry ({{ activeFilterCount() }})
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
          <span class="results-count">{{ filteredDeals().length }} ofert</span>
          @if (lastUpdate()) {
            <span class="last-update">Ostatnia aktualizacja: {{ lastUpdate() }}</span>
          }
        </div>

        @if (filteredDeals().length === 0) {
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

          @if (visibleDeals().length < filteredDeals().length) {
            <div class="load-more">
              <button mat-stroked-button (click)="loadMore()">
                Pokaż więcej ({{ filteredDeals().length - visibleDeals().length }} pozostałych)
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
      gap: 0;
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

  loading = signal(true);
  error = signal(false);
  allDeals = signal<Deal[]>([]);
  lastUpdate = signal<string | null>(null);

  selectedCountries: string[] = [];
  selectedOrigins: string[] = [];
  maxPriceValue = 800;
  sortBy: 'price' | 'departure' | 'duration' = 'price';
  visibleCount = signal(24);

  maxPrice = computed(() => this.maxPriceValue);
  savedCount = computed(() => this.savedService.savedDeals().length);

  availableCountries = computed(() => {
    const codes = new Set(this.allDeals().map((d) => d.destCountry));
    return [...codes].sort().map((code) => ({
      code,
      name: COUNTRY_NAMES[code] ?? code,
      flag: this.countryFlag(code),
    }));
  });

  availableOrigins = computed(() => {
    const codes = new Set(this.allDeals().map((d) => d.originAirport));
    return [...codes].sort();
  });

  filteredDeals = computed(() => {
    let deals = this.allDeals();

    if (this.selectedCountries.length > 0) {
      deals = deals.filter((d) => this.selectedCountries.includes(d.destCountry));
    }
    if (this.selectedOrigins.length > 0) {
      deals = deals.filter((d) => this.selectedOrigins.includes(d.originAirport));
    }
    deals = deals.filter((d) => d.totalPrice <= this.maxPriceValue);

    deals = [...deals].sort((a, b) => {
      if (this.sortBy === 'departure') return a.departAt.localeCompare(b.departAt);
      if (this.sortBy === 'duration') return a.nights - b.nights;
      return a.totalPrice - b.totalPrice;
    });

    return deals;
  });

  visibleDeals = computed(() => this.filteredDeals().slice(0, this.visibleCount()));

  activeFilterCount = computed(() => {
    let n = 0;
    if (this.selectedCountries.length > 0) n++;
    if (this.selectedOrigins.length > 0) n++;
    if (this.maxPriceValue < 800) n++;
    return n;
  });

  ngOnInit() {
    this.dealsService.getDeals().subscribe({
      next: (deals) => {
        this.allDeals.set(deals);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });

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
    this.selectedCountries = [];
    this.selectedOrigins = [];
    this.maxPriceValue = 800;
    this.sortBy = 'price';
  }

  airportName(code: string): string {
    return AIRPORT_NAMES[code] ?? code;
  }

  countryFlag(code: string): string {
    const flags: Record<string, string> = {
      IT: '🇮🇹', ES: '🇪🇸', GR: '🇬🇷', HR: '🇭🇷', PT: '🇵🇹',
      MT: '🇲🇹', CY: '🇨🇾', TR: '🇹🇷', BG: '🇧🇬', FR: '🇫🇷',
      AL: '🇦🇱', ME: '🇲🇪',
    };
    return flags[code] ?? '🌍';
  }
}
