import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class CityImagesService {
  private http = inject(HttpClient);
  private cache = signal<Record<string, string>>({});

  imageUrl(city: string): string | null {
    return this.cache()[city] ?? null;
  }

  fetchBatch(cities: string[]) {
    const missing = [...new Set(cities)].filter((c) => !(c in this.cache()));
    if (!missing.length) return;

    this.http
      .get<Record<string, string>>(`${environment.apiUrl}/city-images`, {
        params: { cities: missing.join(',') },
      })
      .subscribe({
        next: (map) => this.cache.update((prev) => ({ ...prev, ...map })),
        error: () => {},
      });
  }
}
