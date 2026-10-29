import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import type { Deal } from '../models/deal.model';

export interface DealsQueryParams {
  destCountry?: string;
  maxPrice?: number;
  origin?: string;
  sort?: 'price' | 'departure' | 'duration';
  levels?: string;
  minNights?: number;
  maxNights?: number;
  depDays?: string; // comma-separated JS day numbers: "1,2,3" (0=Sun)
  retDays?: string;
  depTimes?: string; // comma-separated: "morning,afternoon,evening"
  retTimes?: string;
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
    if (query.levels) params = params.set('levels', query.levels);
    if (query.minNights != null) params = params.set('minNights', String(query.minNights));
    if (query.maxNights != null) params = params.set('maxNights', String(query.maxNights));
    if (query.depDays) params = params.set('depDays', query.depDays);
    if (query.retDays) params = params.set('retDays', query.retDays);
    if (query.depTimes) params = params.set('depTimes', query.depTimes);
    if (query.retTimes) params = params.set('retTimes', query.retTimes);
    return this.http.get<Deal[]>(`${environment.apiUrl}/deals`, { params });
  }

  getHealth() {
    return this.http.get<{ status: string; lastSuccessfulRun: string | null; dealsFound: number }>(
      `${environment.apiUrl}/health`,
    );
  }
}
