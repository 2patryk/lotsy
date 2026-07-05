import { Component, inject, computed } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmBadge } from '@spartan-ng/helm/badge';
import { SavedDealsService } from '../services/saved-deals.service';

@Component({
  selector: 'app-site-header',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, HlmButton, HlmBadge],
  template: `
    <header class="sticky top-0 z-50 h-14 border-b border-border bg-card">
      <div class="mx-auto flex h-full max-w-[1100px] items-center gap-3 px-3 sm:gap-5 sm:px-6">
        <a [routerLink]="['/deals']" class="flex shrink-0 items-center gap-2" aria-label="Lotsy">
          <svg width="30" height="30" viewBox="0 0 32 32" fill="none" aria-hidden="true">
            <defs>
              <linearGradient
                id="lotsy-mark-grad"
                x1="4"
                y1="28"
                x2="28"
                y2="4"
                gradientUnits="userSpaceOnUse"
              >
                <stop stop-color="#e8680a" />
                <stop offset="1" stop-color="#ffa23c" />
              </linearGradient>
            </defs>
            <rect width="32" height="32" rx="9" fill="url(#lotsy-mark-grad)" />
            <g transform="translate(16.5 16) rotate(-38) scale(0.72) translate(-12.5 -12)">
              <path fill="#fff" d="M2.01 21 23 12 2.01 3 2 10l15 2-15 2z" />
            </g>
          </svg>
          <span class="text-lg font-extrabold tracking-tight text-foreground">Lotsy</span>
        </a>

        <nav
          class="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto whitespace-nowrap [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <a
            hlmBtn
            variant="ghost"
            size="sm"
            [routerLink]="['/deals']"
            routerLinkActive="bg-primary/10 text-primary font-semibold"
            [routerLinkActiveOptions]="{ exact: true }"
            class="shrink-0 text-muted-foreground"
          >
            Okazje
          </a>
          <a
            hlmBtn
            variant="ghost"
            size="sm"
            [routerLink]="['/czartery']"
            routerLinkActive="bg-primary/10 text-primary font-semibold"
            class="shrink-0 text-muted-foreground"
          >
            Czartery
          </a>
          <a
            hlmBtn
            variant="ghost"
            size="sm"
            [routerLink]="['/jedna-strona']"
            routerLinkActive="bg-primary/10 text-primary font-semibold"
            class="shrink-0 text-muted-foreground"
          >
            W jedną stronę
          </a>
        </nav>

        <a
          hlmBtn
          variant="ghost"
          size="sm"
          [routerLink]="['/deals/saved']"
          routerLinkActive="bg-primary/10 text-primary font-semibold"
          class="ml-auto shrink-0 gap-1.5 text-muted-foreground"
        >
          Zapisane
          @if (savedCount() > 0) {
            <span hlmBadge class="px-1.5">{{ savedCount() }}</span>
          }
        </a>
      </div>
    </header>
  `,
})
export class SiteHeaderComponent {
  private savedService = inject(SavedDealsService);
  savedCount = computed(() => this.savedService.savedDeals().length);
}
