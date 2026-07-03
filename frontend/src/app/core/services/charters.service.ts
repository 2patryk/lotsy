import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import type { CharterFlight, ChartersMeta } from '../models/charter-offer.model';

export interface CharterFlightsQueryParams {
  oneWay: boolean;
  origin?: string; // comma-separated IATA
  destCountry?: string; // comma-separated country names
  dateFrom?: string; // YYYY-MM-DD
  dateTo?: string;
  days?: string; // comma-separated JS day numbers: "1,2,3" (0=Sun)
  minPrice?: number;
  maxPrice?: number;
  sort?: 'price' | 'date';
}

@Injectable({ providedIn: 'root' })
export class ChartersService {
  private http = inject(HttpClient);

  getFlights(query: CharterFlightsQueryParams) {
    let params = new HttpParams().set('oneWay', String(query.oneWay));
    if (query.origin) params = params.set('origin', query.origin);
    if (query.destCountry) params = params.set('destCountry', query.destCountry);
    if (query.dateFrom) params = params.set('dateFrom', query.dateFrom);
    if (query.dateTo) params = params.set('dateTo', query.dateTo);
    if (query.days) params = params.set('days', query.days);
    if (query.minPrice != null) params = params.set('minPrice', String(query.minPrice));
    if (query.maxPrice != null) params = params.set('maxPrice', String(query.maxPrice));
    if (query.sort) params = params.set('sort', query.sort);
    return this.http.get<CharterFlight[]>(`${environment.apiUrl}/charters/flights`, { params });
  }

  getMeta() {
    return this.http.get<ChartersMeta>(`${environment.apiUrl}/charters/meta`);
  }
}
