import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import type { Airport } from '../models/airport.model';

@Injectable({ providedIn: 'root' })
export class AirportsService {
  private http = inject(HttpClient);

  private all = signal<Airport[]>([]);

  // Map of IATA → city name for fast lookup
  nameMap = computed(() => {
    const m = new Map<string, string>();
    for (const a of this.all()) m.set(a.iata, a.name);
    return m;
  });

  polishAirports = computed(() => this.all().filter((a) => a.isPolish));

  cityName(iata: string): string {
    return this.nameMap().get(iata) ?? iata;
  }

  load() {
    this.http.get<Airport[]>(`${environment.apiUrl}/airports`).subscribe({
      next: (airports) => this.all.set(airports),
      error: () => {},
    });
  }
}
