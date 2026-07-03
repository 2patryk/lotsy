import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ChartersService } from '../../core/services/charters.service';
import type { CharterOffer } from '../../core/models/charter-offer.model';

type PriceMode = 'roundTrip' | 'oneWay';

@Component({
  selector: 'app-charters-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <header class="site-header">
      <div class="header-inner">
        <a [routerLink]="['/deals']" class="logo-link" aria-label="Lotsy">
          <svg width="110" height="32" viewBox="0 0 122 36" fill="none">
            <circle cx="18" cy="18" r="16" fill="#f48120" />
            <g transform="translate(8.5,9.5) scale(0.85)">
              <path
                fill="white"
                d="M23 10 L17 8 L10 1 L8 3 L13 8 L4 8 L2 6 L1 10 L2 14 L4 12 L13 12 L8 17 L10 19 L17 12 Z"
              />
            </g>
            <text
              x="42"
              y="24"
              font-family="Outfit,system-ui,sans-serif"
              font-weight="800"
              font-size="20"
              fill="#1a1a1a"
              letter-spacing="-0.5"
            >
              Lotsy
            </text>
          </svg>
        </a>
        <nav class="main-nav">
          <a class="nav-item" [routerLink]="['/deals']">Okazje</a>
          <span class="nav-item active">Czartery</span>
        </nav>
      </div>
    </header>

    <main class="page">
      <div class="page-head">
        <h1>Loty czarterowe</h1>
        <p>
          Najtańsze bilety czarterowe Rainbow · cena za osobę
          @if (lastUpdate()) {
            <span class="muted"> · Odświeżono: {{ lastUpdate() }}</span>
          }
        </p>
      </div>

      <div class="toolbar">
        <div class="mode-toggle" role="tablist">
          <button
            class="mode-btn"
            role="tab"
            [class.active]="mode() === 'roundTrip'"
            (click)="setMode('roundTrip')"
          >
            W obie strony
          </button>
          <button
            class="mode-btn"
            role="tab"
            [class.active]="mode() === 'oneWay'"
            (click)="setMode('oneWay')"
          >
            W jedną stronę
          </button>
        </div>
        <span class="count">{{ offers().length }} kierunków</span>
      </div>

      @if (loading()) {
        <div class="state-info">Ładowanie…</div>
      } @else if (error()) {
        <div class="state-info error">Nie udało się pobrać ofert. Spróbuj ponownie później.</div>
      } @else if (offers().length === 0) {
        <div class="state-info">
          Brak ofert w bazie — silnik czarterów jeszcze nie zebrał danych.
        </div>
      } @else {
        <div class="grid">
          @for (offer of offers(); track offer.destIata) {
            <a class="card" [href]="bookingUrl(offer)" target="_blank" rel="noopener">
              <div class="card-img">
                @if (offer.imageUrl) {
                  <img [src]="offer.imageUrl" [alt]="offer.destName" loading="lazy" />
                } @else {
                  <div class="img-placeholder"></div>
                }
              </div>
              <div class="card-body">
                <div class="card-title-row">
                  <span class="dest">{{ offer.destName }}</span>
                  <span class="iata">{{ offer.destIata }}</span>
                </div>
                <div class="country">{{ offer.destCountry }}</div>
                <div class="card-foot">
                  <div class="price-block">
                    <span class="price">od {{ price(offer) }} zł</span>
                    <span class="price-sub">{{
                      mode() === 'roundTrip' ? 'w obie strony' : 'w jedną stronę'
                    }}</span>
                  </div>
                  @if (altPrice(offer) !== null) {
                    <span class="alt-price">
                      {{ mode() === 'roundTrip' ? '1 str.' : 'obie str.' }}: od
                      {{ altPrice(offer) }} zł
                    </span>
                  }
                </div>
                @if (offer.baggageKg) {
                  <div class="baggage">Bagaż {{ offer.baggageKg }} kg w cenie</div>
                }
              </div>
            </a>
          }
        </div>
      }
    </main>
  `,
  styles: [
    `
      .site-header {
        position: sticky;
        top: 0;
        z-index: 200;
        height: var(--header-h);
        background: var(--color-surface);
        border-bottom: 1px solid var(--color-border);
      }
      .header-inner {
        max-width: 1060px;
        margin: 0 auto;
        padding: 0 24px;
        height: 100%;
        display: flex;
        align-items: center;
        gap: 24px;
      }
      .logo-link {
        display: flex;
        align-items: center;
      }
      .main-nav {
        display: flex;
        gap: 4px;
      }
      .nav-item {
        padding: 5px 12px;
        border-radius: var(--radius-md);
        border: none;
        font-size: 14px;
        font-weight: 400;
        cursor: pointer;
        color: var(--color-text-secondary);
        background: transparent;
        text-decoration: none;
        transition: all 0.12s;
      }
      .nav-item.active {
        font-weight: 600;
        color: var(--color-blue-700);
        background: var(--color-blue-50);
        cursor: default;
      }

      .page {
        max-width: 1060px;
        margin: 0 auto;
        padding: 28px 24px 48px;
      }
      .page-head h1 {
        margin: 0;
        font-size: 22px;
        font-weight: 700;
        color: var(--color-text-primary);
      }
      .page-head p {
        margin: 6px 0 0;
        font-size: 14px;
        color: var(--color-text-secondary);
      }
      .muted {
        color: var(--color-text-tertiary);
      }

      .toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin: 20px 0 16px;
        gap: 12px;
        flex-wrap: wrap;
      }
      .mode-toggle {
        display: inline-flex;
        background: var(--color-sidebar-active);
        border-radius: var(--radius-md);
        padding: 3px;
        gap: 2px;
      }
      .mode-btn {
        border: none;
        background: transparent;
        padding: 6px 14px;
        font-size: 13px;
        font-weight: 500;
        color: var(--color-text-secondary);
        border-radius: calc(var(--radius-md) - 2px);
        cursor: pointer;
        transition: all 0.12s;
      }
      .mode-btn.active {
        background: var(--color-surface);
        color: var(--color-blue-700);
        font-weight: 600;
        box-shadow: var(--shadow-sm);
      }
      .count {
        font-size: 13px;
        color: var(--color-text-tertiary);
      }

      .state-info {
        padding: 60px 20px;
        text-align: center;
        font-size: 14px;
        color: var(--color-text-secondary);
      }
      .state-info.error {
        color: var(--color-amber-700);
      }

      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
        gap: 16px;
      }
      .card {
        display: flex;
        flex-direction: column;
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-lg);
        overflow: hidden;
        text-decoration: none;
        color: inherit;
        box-shadow: var(--shadow-sm);
        transition:
          box-shadow 0.15s,
          transform 0.15s;
      }
      .card:hover {
        box-shadow: var(--shadow-md, 0 4px 12px rgba(0, 0, 0, 0.1));
        transform: translateY(-2px);
      }
      .card-img {
        aspect-ratio: 410 / 225;
        background: var(--color-sidebar-active);
      }
      .card-img img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }
      .img-placeholder {
        width: 100%;
        height: 100%;
      }
      .card-body {
        padding: 12px 14px 14px;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .card-title-row {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 8px;
      }
      .dest {
        font-size: 15px;
        font-weight: 600;
        color: var(--color-text-primary);
      }
      .iata {
        font-size: 11px;
        font-weight: 600;
        color: var(--color-text-tertiary);
        letter-spacing: 0.05em;
      }
      .country {
        font-size: 13px;
        color: var(--color-text-secondary);
      }
      .card-foot {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 8px;
        margin-top: 10px;
      }
      .price-block {
        display: flex;
        align-items: baseline;
        gap: 6px;
      }
      .price {
        font-size: 17px;
        font-weight: 700;
        color: var(--color-blue-700);
        white-space: nowrap;
      }
      .price-sub {
        font-size: 11px;
        color: var(--color-text-tertiary);
      }
      .alt-price {
        font-size: 11px;
        color: var(--color-text-tertiary);
        white-space: nowrap;
      }
      .baggage {
        margin-top: 4px;
        font-size: 11px;
        color: var(--color-text-tertiary);
      }
    `,
  ],
})
export class ChartersPageComponent {
  private chartersService = inject(ChartersService);

  mode = signal<PriceMode>('roundTrip');
  loading = signal(true);
  error = signal(false);
  private response = signal<{ offers: CharterOffer[]; lastUpdate: string | null }>({
    offers: [],
    lastUpdate: null,
  });

  offers = computed(() => this.response().offers);
  lastUpdate = computed(() => {
    const ts = this.response().lastUpdate;
    if (!ts) return null;
    return new Date(ts).toLocaleString('pl-PL', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  });

  constructor() {
    this.load();
  }

  setMode(mode: PriceMode) {
    if (this.mode() === mode) return;
    this.mode.set(mode);
    this.load();
  }

  private load() {
    this.loading.set(true);
    this.error.set(false);
    this.chartersService.getOffers(this.mode()).subscribe({
      next: (res) => {
        this.response.set(res);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }

  price(offer: CharterOffer): number | null {
    return this.mode() === 'roundTrip' ? offer.priceRoundTrip : offer.priceOneWay;
  }

  altPrice(offer: CharterOffer): number | null {
    return this.mode() === 'roundTrip' ? offer.priceOneWay : offer.priceRoundTrip;
  }

  bookingUrl(offer: CharterOffer): string {
    return `https://r.pl/bilety-czarterowe/${offer.destCountryUrl}/${offer.destNameUrl}`;
  }
}
