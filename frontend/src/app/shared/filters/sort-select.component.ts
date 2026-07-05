import { Component, input, output } from '@angular/core';

export interface SortOption {
  value: string;
  label: string;
}

/** Native sort select styled to match spartan inputs, shared by all tabs. */
@Component({
  selector: 'app-sort-select',
  standalone: true,
  template: `
    <div class="flex min-w-36 flex-col gap-1.5">
      <label class="text-xs font-medium text-muted-foreground">{{ label() }}</label>
      <select
        class="h-8 w-full cursor-pointer rounded-md border border-input bg-background px-2.5 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        [value]="value()"
        (change)="changed.emit($any($event.target).value)"
      >
        @for (o of options(); track o.value) {
          <option [value]="o.value" [selected]="value() === o.value">{{ o.label }}</option>
        }
      </select>
    </div>
  `,
})
export class SortSelectComponent {
  label = input('Sortowanie');
  options = input.required<SortOption[]>();
  value = input.required<string>();
  changed = output<string>();
}
