import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DealCardComponent } from '../deals/deal-card.component';
import { SavedDealsService } from '../../core/services/saved-deals.service';

@Component({
  selector: 'app-saved-deals-page',
  standalone: true,
  imports: [CommonModule, RouterLink, DealCardComponent],
  template: `
    <header class="site-header">
      <div class="header-inner">
        <a [routerLink]="['/deals']" class="back-btn" aria-label="Wróć do okazji">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M10 12L6 8l4-4"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          Okazje
        </a>
        <span class="header-title">Zapisane</span>
      </div>
    </header>

    <main class="page-main">
      @if (saved().length > 0) {
        <div class="disclaimer">
          Oferty zachowane lokalnie · Ceny mogą być nieaktualne · Przechowywane 48h od zapisania
        </div>
      }

      @if (saved().length === 0) {
        <div class="empty-state">
          <div class="empty-icon">♡</div>
          <div class="empty-title">Brak zapisanych ofert</div>
          <div class="empty-sub">Kliknij ♡ na ofercie, żeby ją zapisać</div>
          <a [routerLink]="['/deals']" class="btn-primary">Przeglądaj okazje</a>
        </div>
      } @else {
        <div class="results-card">
          @for (entry of saved(); track entry.deal.id) {
            <div class="saved-entry">
              <div class="saved-meta">Zapisano: {{ formatDate(entry.savedAt) }}</div>
              <app-deal-card [deal]="entry.deal" />
            </div>
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
        gap: 16px;
      }
      .back-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 5px 10px;
        border-radius: var(--radius-md);
        font-size: 14px;
        font-weight: 500;
        color: var(--color-text-secondary);
        text-decoration: none;
        transition: background 0.12s;
      }
      .back-btn:hover {
        background: var(--color-sidebar-active);
      }
      .header-title {
        font-size: 15px;
        font-weight: 600;
        color: var(--color-text-primary);
      }

      .page-main {
        max-width: 1060px;
        margin: 0 auto;
        padding: 28px 24px 48px;
        display: flex;
        flex-direction: column;
        gap: 20px;
      }

      .disclaimer {
        font-size: 13px;
        color: var(--color-amber-700);
        background: var(--color-amber-100);
        padding: 10px 16px;
        border-radius: var(--radius-md);
      }

      .results-card {
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-lg);
        overflow: hidden;
        box-shadow: var(--shadow-sm);
      }

      .saved-entry {
        display: flex;
        flex-direction: column;
      }
      .saved-meta {
        font-size: 11px;
        color: var(--color-text-tertiary);
        padding: 8px 20px 0;
        font-weight: 500;
        letter-spacing: 0.02em;
      }

      .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
        padding: 80px 20px;
        text-align: center;
      }
      .empty-icon {
        font-size: 40px;
        color: var(--color-text-tertiary);
        line-height: 1;
      }
      .empty-title {
        font-size: 16px;
        font-weight: 600;
        color: var(--color-text-secondary);
      }
      .empty-sub {
        font-size: 14px;
        color: var(--color-text-tertiary);
      }

      .btn-primary {
        display: inline-flex;
        align-items: center;
        padding: 8px 20px;
        border-radius: var(--radius-md);
        font-size: 14px;
        font-weight: 500;
        background: var(--color-blue-700);
        color: #fff;
        text-decoration: none;
        margin-top: 4px;
        transition: background 0.12s;
      }
      .btn-primary:hover {
        background: var(--color-blue-800);
      }
    `,
  ],
})
export class SavedDealsPageComponent {
  private savedService = inject(SavedDealsService);
  saved = computed(() => this.savedService.savedDeals());

  formatDate(ts: number): string {
    return new Date(ts).toLocaleString('pl-PL', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
