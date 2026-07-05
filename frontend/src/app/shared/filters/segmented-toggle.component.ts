import { Component, input, output } from '@angular/core';
import { HlmButton } from '@spartan-ng/helm/button';

export interface SegmentOption {
  value: string;
  label: string;
}

/** Two-to-few option segmented control (ticket type, direction), shared by all tabs. */
@Component({
  selector: 'app-segmented-toggle',
  standalone: true,
  imports: [HlmButton],
  template: `
    <div class="flex flex-col gap-1.5">
      <label class="text-xs font-medium text-muted-foreground">{{ label() }}</label>
      <div
        class="inline-flex gap-0.5 rounded-lg border border-border bg-muted p-0.5"
        role="tablist"
      >
        @for (o of options(); track o.value) {
          <button
            hlmBtn
            size="sm"
            role="tab"
            class="h-7"
            [variant]="value() === o.value ? 'default' : 'ghost'"
            (click)="changed.emit(o.value)"
          >
            {{ o.label }}
          </button>
        }
      </div>
    </div>
  `,
})
export class SegmentedToggleComponent {
  label = input.required<string>();
  options = input.required<SegmentOption[]>();
  value = input.required<string>();
  changed = output<string>();
}
