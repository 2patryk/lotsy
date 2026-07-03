import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import type { ChartersResponse } from '../models/charter-offer.model';

@Injectable({ providedIn: 'root' })
export class ChartersService {
  private http = inject(HttpClient);

  getOffers(sort: 'roundTrip' | 'oneWay' = 'roundTrip', country?: string) {
    let params = new HttpParams().set('sort', sort);
    if (country) params = params.set('country', country);
    return this.http.get<ChartersResponse>(`${environment.apiUrl}/charters`, { params });
  }
}
