import { Component, input, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import type { Deal } from '../../core/models/deal.model';
import { SavedDealsService } from '../../core/services/saved-deals.service';

const COUNTRY_FLAGS: Record<string, string> = {
  IT: '🇮🇹', ES: '🇪🇸', GR: '🇬🇷', HR: '🇭🇷', PT: '🇵🇹',
  MT: '🇲🇹', CY: '🇨🇾', TR: '🇹🇷', BG: '🇧🇬', FR: '🇫🇷',
  AL: '🇦🇱', ME: '🇲🇪', MA: '🇲🇦', IL: '🇮🇱', TN: '🇹🇳',
  RS: '🇷🇸', RO: '🇷🇴', BA: '🇧🇦', MK: '🇲🇰', XK: '🇽🇰',
  GB: '🇬🇧', IE: '🇮🇪', IS: '🇮🇸', JO: '🇯🇴',
};

const COUNTRY_NAMES: Record<string, string> = {
  IT: 'Włochy', ES: 'Hiszpania', GR: 'Grecja', HR: 'Chorwacja',
  PT: 'Portugalia', MT: 'Malta', CY: 'Cypr', TR: 'Turcja',
  BG: 'Bułgaria', FR: 'Francja', AL: 'Albania', ME: 'Czarnogóra',
  MA: 'Maroko', IL: 'Izrael', TN: 'Tunezja', RS: 'Serbia',
  RO: 'Rumunia', BA: 'Bośnia', MK: 'Macedonia', XK: 'Kosowo',
  GB: 'Wielka Brytania', IE: 'Irlandia', IS: 'Islandia', JO: 'Jordania',
};

const WEEKDAYS = ['ndz', 'pon', 'wt', 'śr', 'czw', 'pt', 'sob'];
const MONTHS = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'];

@Component({
  selector: 'app-deal-card',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatButtonModule, MatIconModule, MatChipsModule, MatTooltipModule],
  template: `
    <mat-card class="deal-card" [class.mixed]="deal().mixedCarrier">
      <mat-card-header>
        <div class="card-header-content">
          <span class="flag">{{ flag() }}</span>
          <div class="destination">
            <span class="country-name">{{ countryName() }}</span>
            <span class="airport-pair">
              {{ deal().originAirport }} ✈ {{ deal().destAirport }}
              @if (deal().openJaw) {
                <span class="return-airport"> ✈ {{ deal().returnAirport }}</span>
              }
            </span>
          </div>
          <button
            mat-icon-button
            class="save-btn"
            [matTooltip]="isSaved() ? 'Usuń z zapisanych' : 'Zapisz ofertę'"
            (click)="toggleSave()"
          >
            <mat-icon>{{ isSaved() ? 'favorite' : 'favorite_border' }}</mat-icon>
          </button>
        </div>
      </mat-card-header>

      <mat-card-content>
        <div class="flight-info">
          <div class="leg">
            <span class="leg-label">Wylot</span>
            <span class="leg-date">{{ formatDate(deal().departAt) }}</span>
            <span class="leg-airline">{{ deal().outboundAirline }}</span>
          </div>
          <div class="nights-badge">
            <span>{{ deal().nights }}</span>
            <span class="nights-label">nocy</span>
          </div>
          <div class="leg">
            <span class="leg-label">Powrót</span>
            <span class="leg-date">{{ formatDate(deal().returnAt) }}</span>
            <span class="leg-airline">{{ deal().returnAirline }}</span>
          </div>
        </div>

        @if (deal().openJaw) {
          <div class="open-jaw-badge">
            ✈→✈ Open-jaw — powrót do {{ deal().returnAirport }} (inny lot)
          </div>
        }
        @if (deal().mixedCarrier) {
          <div class="mixed-warning">
            🔀 2 osobne bilety — oddzielne rezerwacje
          </div>
        }

        <div class="price-section">
          <div class="price">
            <span class="price-value">{{ deal().totalPrice | number:'1.0-0' }} zł</span>
            @if (deal().mixedCarrier) {
              <span class="price-breakdown">
                ({{ deal().outboundPrice | number:'1.0-0' }} + {{ deal().returnPrice | number:'1.0-0' }})
              </span>
            }
            <span class="price-label">/os.</span>
          </div>
        </div>
      </mat-card-content>

      <mat-card-actions>
        <a mat-raised-button color="primary" [href]="deal().outboundBookingUrl" target="_blank" rel="noopener">
          <mat-icon>open_in_new</mat-icon> Rezerwuj
        </a>
      </mat-card-actions>
    </mat-card>
  `,
  styles: [`
    .deal-card {
      height: 100%;
      display: flex;
      flex-direction: column;
      transition: box-shadow 0.2s;
    }
    .deal-card:hover { box-shadow: 0 6px 20px rgba(0,0,0,0.15); }

    .card-header-content {
      display: flex;
      align-items: center;
      gap: 10px;
      width: 100%;
    }
    .flag { font-size: 2rem; line-height: 1; }
    .destination { flex: 1; }
    .country-name { display: block; font-weight: 600; font-size: 1.1rem; }
    .airport-pair { font-size: 0.85rem; color: #666; }
    .return-airport { color: #1565c0; font-weight: 600; }
    .save-btn { color: #e91e63; }

    .flight-info {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin: 12px 0;
      padding: 12px;
      background: #f8f9fa;
      border-radius: 8px;
    }
    .leg { text-align: center; }
    .leg-label { display: block; font-size: 0.72rem; text-transform: uppercase; color: #999; letter-spacing: 0.05em; }
    .leg-date { display: block; font-weight: 600; font-size: 0.9rem; }
    .leg-airline { display: block; font-size: 0.75rem; color: #666; }
    .nights-badge {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 8px 14px;
      background: #e3f2fd;
      border-radius: 20px;
      font-weight: 700;
      font-size: 1.2rem;
      color: #1565c0;
    }
    .nights-label { font-size: 0.65rem; font-weight: 400; color: #1976d2; }

    .open-jaw-badge {
      font-size: 0.78rem;
      color: #1565c0;
      background: #e3f2fd;
      padding: 6px 10px;
      border-radius: 6px;
      margin-bottom: 6px;
    }
    .mixed-warning {
      font-size: 0.78rem;
      color: #f57c00;
      background: #fff3e0;
      padding: 6px 10px;
      border-radius: 6px;
      margin-bottom: 8px;
    }

    .price-section { margin-top: 8px; }
    .price { display: flex; align-items: baseline; gap: 4px; }
    .price-value { font-size: 1.6rem; font-weight: 700; color: #1565c0; }
    .price-breakdown { font-size: 0.78rem; color: #999; }
    .price-label { font-size: 0.85rem; color: #666; }

    mat-card-actions { margin-top: auto; padding-bottom: 8px; }
    mat-card-actions a { display: inline-flex; align-items: center; gap: 4px; }
  `],
})
export class DealCardComponent {
  deal = input.required<Deal>();

  private savedService = inject(SavedDealsService);
  isSaved = computed(() => this.savedService.isSaved(this.deal().id));

  flag() {
    return COUNTRY_FLAGS[this.deal().destCountry] ?? '✈️';
  }

  countryName() {
    return COUNTRY_NAMES[this.deal().destCountry] ?? this.deal().destCountry;
  }

  toggleSave() {
    this.savedService.toggle(this.deal());
  }

  formatDate(isoStr: string): string {
    const d = new Date(isoStr);
    return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  }
}
