import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import type { OneWayDirection, OneWayFare, OneWayMeta } from '../models/oneway-fare.model';

export interface OneWayFaresQueryParams {
  direction: OneWayDirection;
  plAirport?: string; // comma-separated IATA
  country?: string; // comma-separated country names
  city?: string; // comma-separated city names
  dateFrom?: string; // YYYY-MM-DD
  dateTo?: string;
  days?: string; // comma-separated JS day numbers: "1,2,3" (0=Sun)
  minPrice?: number;
  maxPrice?: number;
  sort?: 'price' | 'date';
}

@Injectable({ providedIn: 'root' })
export class OneWayService {
  private http = inject(HttpClient);

  getFares(query: OneWayFaresQueryParams) {
    let params = new HttpParams().set('direction', query.direction.toLowerCase());
    if (query.plAirport) params = params.set('plAirport', query.plAirport);
    if (query.country) params = params.set('country', query.country);
    if (query.city) params = params.set('city', query.city);
    if (query.dateFrom) params = params.set('dateFrom', query.dateFrom);
    if (query.dateTo) params = params.set('dateTo', query.dateTo);
    if (query.days) params = params.set('days', query.days);
    if (query.minPrice != null) params = params.set('minPrice', String(query.minPrice));
    if (query.maxPrice != null) params = params.set('maxPrice', String(query.maxPrice));
    if (query.sort) params = params.set('sort', query.sort);
    return this.http.get<OneWayFare[]>(`${environment.apiUrl}/oneway/fares`, { params });
  }

  getMeta(direction: OneWayDirection) {
    const params = new HttpParams().set('direction', direction.toLowerCase());
    return this.http.get<OneWayMeta>(`${environment.apiUrl}/oneway/meta`, { params });
  }
}
