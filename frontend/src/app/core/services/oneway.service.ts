import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import type {
  OneWayDirection,
  OneWayFare,
  OneWayMeta,
  OnwardCarrier,
  OnwardFlight,
  OnwardMode,
} from '../models/oneway-fare.model';

export interface OneWayFaresQueryParams {
  direction: OneWayDirection;
  plAirport?: string; // comma-separated IATA
  country?: string; // comma-separated country names
  city?: string; // comma-separated city names
  airport?: string; // comma-separated foreign-side IATA codes
  excludeCountry?: string; // negative variants ("wszystko oprócz")
  excludeCity?: string;
  excludeAirport?: string;
  dateFrom?: string; // YYYY-MM-DD
  dateTo?: string;
  days?: string; // comma-separated JS day numbers: "1,2,3" (0=Sun)
  times?: string; // comma-separated: "night,morning,afternoon,evening"
  minPrice?: number;
  maxPrice?: number;
  sort?: 'price' | 'date';
  source?: string; // comma-separated: RYANAIR,WIZZAIR,RAINBOW; empty = all
}

@Injectable({ providedIn: 'root' })
export class OneWayService {
  private http = inject(HttpClient);

  getFares(query: OneWayFaresQueryParams) {
    let params = new HttpParams().set('direction', query.direction.toLowerCase());
    if (query.plAirport) params = params.set('plAirport', query.plAirport);
    if (query.country) params = params.set('country', query.country);
    if (query.city) params = params.set('city', query.city);
    if (query.airport) params = params.set('airport', query.airport);
    if (query.excludeCountry) params = params.set('excludeCountry', query.excludeCountry);
    if (query.excludeCity) params = params.set('excludeCity', query.excludeCity);
    if (query.excludeAirport) params = params.set('excludeAirport', query.excludeAirport);
    if (query.dateFrom) params = params.set('dateFrom', query.dateFrom);
    if (query.dateTo) params = params.set('dateTo', query.dateTo);
    if (query.days) params = params.set('days', query.days);
    if (query.times) params = params.set('times', query.times);
    if (query.minPrice != null) params = params.set('minPrice', String(query.minPrice));
    if (query.maxPrice != null) params = params.set('maxPrice', String(query.maxPrice));
    if (query.sort) params = params.set('sort', query.sort);
    if (query.source) params = params.set('source', query.source);
    return this.http.get<OneWayFare[]>(`${environment.apiUrl}/oneway/fares`, { params });
  }

  // Live onward/feeder connections for one airport and day. Fetched per
  // carrier so Ryanair (fast) can render before Wizz (slow fan-out) lands.
  getOnward(query: {
    airport: string;
    date: string;
    carrier: OnwardCarrier;
    mode: OnwardMode;
    windowStart: string;
  }) {
    const params = new HttpParams()
      .set('airport', query.airport)
      .set('date', query.date)
      .set('carrier', query.carrier)
      .set('mode', query.mode)
      .set('windowStart', query.windowStart);
    return this.http.get<OnwardFlight[]>(`${environment.apiUrl}/oneway/onward`, { params });
  }

  getMeta(direction: OneWayDirection) {
    const params = new HttpParams().set('direction', direction.toLowerCase());
    return this.http.get<OneWayMeta>(`${environment.apiUrl}/oneway/meta`, { params });
  }
}
