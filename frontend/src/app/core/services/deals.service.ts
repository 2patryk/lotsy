import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import type { Deal } from '../models/deal.model';

export interface DealsQueryParams {
  destCountry?: string;
  maxPrice?: number;
  origin?: string;
  sort?: 'price' | 'departure' | 'duration';
  openJaw?: 'true' | 'false';
}

@Injectable({ providedIn: 'root' })
export class DealsService {
  private http = inject(HttpClient);

  getDeals(query: DealsQueryParams = {}) {
    let params = new HttpParams();
    if (query.destCountry) params = params.set('destCountry', query.destCountry);
    if (query.maxPrice != null) params = params.set('maxPrice', String(query.maxPrice));
    if (query.origin) params = params.set('origin', query.origin);
    if (query.sort) params = params.set('sort', query.sort);
    if (query.openJaw != null) params = params.set('openJaw', query.openJaw);
    return this.http.get<Deal[]>(`${environment.apiUrl}/deals`, { params });
  }

  getHealth() {
    return this.http.get<{ status: string; lastSuccessfulRun: string | null; dealsFound: number }>(
      `${environment.apiUrl}/health`,
    );
  }
}
