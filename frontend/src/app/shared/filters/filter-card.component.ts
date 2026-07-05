import { Component, effect, input, output, signal } from '@angular/core';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmBadge } from '@spartan-ng/helm/badge';

/**
 * Filter container shared by all tabs. On desktop it renders as an inline
 * card; on mobile it collapses to a sticky "Filtry" trigger that opens the
 * projected filters as a full-screen overlay with its own header and footer.
 */
@Component({
  selector: 'app-filter-card',
  standalone: true,
  imports: [HlmButton, HlmBadge],
  template: `
    <!-- Mobile-only trigger; the card becomes a full-screen overlay when open. -->
    <button
      hlmBtn
      variant="outline"
      class="sticky top-16 z-40 w-full gap-2 shadow-xs sm:hidden"
      type="button"
      (click)="open.set(true)"
    >
      <span>Filtry</span>
      @if (filterCount() > 0) {
        <span hlmBadge class="px-1.5">{{ filterCount() }}</span>
      }
    </button>

    <div
      class="filter-card flex-col overflow-visible rounded-xl border border-border bg-card shadow-xs max-sm:hidden sm:flex"
      [class.open]="open()"
    >
      <div
        class="flex shrink-0 items-center justify-between border-b border-border px-4 py-3 sm:hidden"
      >
        <span class="text-base font-bold">Filtry</span>
        <button
          hlmBtn
          variant="ghost"
          size="icon-sm"
          type="button"
          class="text-xl"
          (click)="open.set(false)"
          aria-label="Zamknij"
        >
          ×
        </button>
      </div>
      <div class="flex flex-1 flex-col gap-4 p-4 max-sm:overflow-y-auto">
        <ng-content />
      </div>
      <div class="flex shrink-0 items-center gap-2 border-t border-border p-3 sm:hidden">
        @if (filterCount() > 0) {
          <button hlmBtn variant="outline" class="flex-1" (click)="cleared.emit()">Wyczyść</button>
        }
        <button hlmBtn class="flex-1" type="button" (click)="open.set(false)">
          Pokaż wyniki ({{ resultsCount() }})
        </button>
      </div>
    </div>
  `,
  styles: [
    `
      /* Mobile: the filter card becomes a full-screen overlay. Structural rules
         only — colors come from the theme tokens used in the template. */
      @media (max-width: 639.98px) {
        .filter-card.open {
          display: flex;
          position: fixed;
          inset: 0;
          z-index: 60;
          border-radius: 0;
          border: none;
          box-shadow: none;
        }
      }
    `,
  ],
})
export class FilterCardComponent {
  /** Number of active filters; shows the trigger badge and the clear button. */
  filterCount = input(0);
  /** Result count shown on the mobile "Pokaż wyniki" button. */
  resultsCount = input(0);
  cleared = output<void>();

  open = signal(false);

  constructor() {
    // Lock body scroll while the mobile overlay is open.
    effect(() => {
      document.body.style.overflow = this.open() ? 'hidden' : '';
    });
  }
}
