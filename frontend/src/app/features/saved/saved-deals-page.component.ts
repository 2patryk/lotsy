import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HlmButton } from '@spartan-ng/helm/button';
import { DealCardComponent } from '../deals/deal-card.component';
import { SavedDealsService } from '../../core/services/saved-deals.service';

@Component({
  selector: 'app-saved-deals-page',
  standalone: true,
  imports: [CommonModule, RouterLink, HlmButton, DealCardComponent],
  template: `
    <main class="mx-auto flex max-w-[1100px] flex-col gap-5 px-3 py-7 sm:px-6">
      <!-- page head -->
      <div class="flex flex-col gap-1">
        <h1 class="text-2xl font-bold tracking-tight">Zapisane</h1>
        <p class="text-sm text-muted-foreground">Oferty zachowane lokalnie</p>
      </div>

      @if (saved().length > 0) {
        <div class="rounded-md bg-secondary px-4 py-2.5 text-sm text-muted-foreground">
          Ceny mogą być nieaktualne · Przechowywane 48h od zapisania
        </div>
      }

      @if (saved().length === 0) {
        <div class="flex flex-col items-center gap-3 py-20 text-center">
          <div class="text-3xl text-muted-foreground/50">♡</div>
          <div class="font-semibold">Brak zapisanych ofert</div>
          <div class="text-sm text-muted-foreground">Kliknij ♡ na ofercie, żeby ją zapisać</div>
          <a hlmBtn size="sm" [routerLink]="['/deals']">Przeglądaj okazje</a>
        </div>
      } @else {
        <section
          class="overflow-hidden rounded-xl border border-border bg-card shadow-xs divide-y divide-border"
        >
          @for (entry of saved(); track entry.deal.id) {
            <div class="flex flex-col">
              <div class="px-4 py-2 text-xs font-medium text-muted-foreground">
                Zapisano: {{ formatDate(entry.savedAt) }}
              </div>
              <app-deal-card [deal]="entry.deal" />
            </div>
          }
        </section>
      }
    </main>
  `,
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
