import { Component, input, output } from '@angular/core';
import { HlmButton } from '@spartan-ng/helm/button';

export const WEEK_DAYS = [
  { js: 1, label: 'Pn' },
  { js: 2, label: 'Wt' },
  { js: 3, label: 'Śr' },
  { js: 4, label: 'Cz' },
  { js: 5, label: 'Pt' },
  { js: 6, label: 'Sb' },
  { js: 0, label: 'Nd' },
] as const;

/** Day-of-week toggle pills (Pn–Nd), shared by all tabs. */
@Component({
  selector: 'app-day-pills',
  standalone: true,
  imports: [HlmButton],
  template: `
    <div class="flex items-center gap-1">
      @for (d of WEEK_DAYS; track d.js) {
        <button
          hlmBtn
          size="sm"
          [variant]="selected().includes(d.js) ? 'default' : 'outline'"
          class="h-7 shrink-0 rounded-full px-2.5 text-xs"
          (click)="toggled.emit(d.js)"
        >
          {{ d.label }}
        </button>
      }
    </div>
  `,
})
export class DayPillsComponent {
  readonly WEEK_DAYS = WEEK_DAYS;
  /** Selected days as JS day numbers (0 = Sunday). */
  selected = input.required<number[]>();
  toggled = output<number>();
}
