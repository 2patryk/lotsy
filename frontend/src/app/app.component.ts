import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AirportsService } from './core/services/airports.service';
import { SiteHeaderComponent } from './core/layout/site-header.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, SiteHeaderComponent],
  template: `
    <app-site-header />
    <router-outlet />
  `,
})
export class AppComponent implements OnInit {
  private airports = inject(AirportsService);
  ngOnInit() {
    this.airports.load();
  }
}
