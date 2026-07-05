import { Component, computed, input, output, signal } from '@angular/core';
import { HlmButton } from '@spartan-ng/helm/button';

export interface MultiSelectOption {
  value: string;
  label: string;
}

/**
 * Filter dropdown with checkbox options, shared by all tabs. Purely
 * presentational: selection state lives in the page, toggles are emitted.
 */
@Component({
  selector: 'app-multi-select-dropdown',
  standalone: true,
  imports: [HlmButton],
  template: `
    <div class="relative flex min-w-36 flex-1 flex-col gap-1.5" (click)="$event.stopPropagation()">
      <label class="text-xs font-medium text-muted-foreground">{{ label() }}</label>
      <button
        hlmBtn
        variant="outline"
        size="sm"
        class="w-full justify-between gap-2 font-normal"
        [class.border-primary]="isActive()"
        [class.text-primary]="isActive()"
        (click)="open.set(!open())"
      >
        <span class="truncate">{{ buttonLabel() }}</span>
        <svg
          class="shrink-0 text-muted-foreground transition-transform"
          [class.rotate-180]="open()"
          width="10"
          height="6"
          viewBox="0 0 10 6"
        >
          <path
            d="M1 1l4 4 4-4"
            stroke="currentColor"
            stroke-width="1.5"
            fill="none"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>
      @if (open()) {
        <div
          class="absolute top-full left-0 z-50 mt-1 max-h-64 min-w-52 overflow-y-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md"
        >
          @for (o of options(); track o.value) {
            <label
              class="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
            >
              <input
                type="checkbox"
                class="size-3.5 shrink-0 accent-primary"
                [checked]="selected().includes(o.value)"
                (change)="toggled.emit(o.value)"
              />
              {{ o.label }}
            </label>
          }
        </div>
      }
    </div>
  `,
  host: { '(document:click)': 'open.set(false)' },
})
export class MultiSelectDropdownComponent {
  label = input.required<string>();
  options = input.required<MultiSelectOption[]>();
  selected = input.required<string[]>();
  /** Shown when nothing is selected. */
  placeholder = input('Wszystkie');
  /** Custom summary for N selected; defaults to "N wybrane". */
  summary = input<((selected: string[]) => string) | null>(null);
  /** Overrides the "filter is active" highlight; defaults to selected().length > 0. */
  active = input<boolean | null>(null);
  toggled = output<string>();

  open = signal(false);

  isActive = computed(() => this.active() ?? this.selected().length > 0);

  buttonLabel = computed(() => {
    const sel = this.selected();
    if (sel.length === 0) return this.placeholder();
    const fn = this.summary();
    if (fn) return fn(sel);
    return `${sel.length} wybrane`;
  });
}
