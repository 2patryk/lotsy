import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { DealCardComponent } from '../deals/deal-card.component';
import { SavedDealsService } from '../../core/services/saved-deals.service';

@Component({
  selector: 'app-saved-deals-page',
  standalone: true,
  imports: [
    CommonModule, RouterLink,
    MatToolbarModule, MatButtonModule, MatIconModule, MatSnackBarModule,
    DealCardComponent,
  ],
  template: `
    <mat-toolbar color="primary" class="app-toolbar">
      <a mat-icon-button [routerLink]="['/deals']">
        <mat-icon>arrow_back</mat-icon>
      </a>
      <span class="logo">Zapisane oferty</span>
    </mat-toolbar>

    <div class="page-container">
      <div class="disclaimer">
        <mat-icon>info_outline</mat-icon>
        <span>Ceny mogą być nieaktualne. Oferty przechowywane 48h od zapisania.</span>
      </div>

      @if (saved().length === 0) {
        <div class="empty-state">
          <mat-icon>favorite_border</mat-icon>
          <p>Nie masz jeszcze żadnych zapisanych ofert.</p>
          <a mat-raised-button color="primary" [routerLink]="['/deals']">Przeglądaj oferty</a>
        </div>
      } @else {
        <div class="deals-grid">
          @for (entry of saved(); track entry.deal.id) {
            <div class="saved-entry">
              <div class="saved-meta">
                Zapisano: {{ formatDate(entry.savedAt) }}
              </div>
              <app-deal-card [deal]="entry.deal" />
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .app-toolbar { position: sticky; top: 0; z-index: 100; }
    .logo { font-size: 1.2rem; font-weight: 600; margin-left: 8px; }
    .page-container { max-width: 1200px; margin: 0 auto; padding: 16px; }

    .disclaimer {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 16px;
      background: #fff8e1;
      border-radius: 8px;
      font-size: 0.85rem;
      color: #795548;
      margin-bottom: 20px;
    }

    .deals-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 16px;
    }

    .saved-entry { display: flex; flex-direction: column; gap: 4px; }
    .saved-meta { font-size: 0.75rem; color: #999; padding-left: 4px; }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      padding: 80px 20px;
      color: #999;
    }
    .empty-state mat-icon { font-size: 64px; height: 64px; width: 64px; }
  `],
})
export class SavedDealsPageComponent {
  private savedService = inject(SavedDealsService);
  private snackBar = inject(MatSnackBar);

  saved = computed(() => this.savedService.savedDeals());

  formatDate(ts: number): string {
    return new Date(ts).toLocaleString('pl-PL', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  }
}
