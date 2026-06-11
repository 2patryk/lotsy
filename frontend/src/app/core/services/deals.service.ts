import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import type { Deal } from '../models/deal.model';

@Injectable({ providedIn: 'root' })
export class DealsService {
  private http = inject(HttpClient);

  getDeals() {
    return this.http.get<Deal[]>(`${environment.apiUrl}/deals`);
  }

  getHealth() {
    return this.http.get<{ status: string; lastSuccessfulRun: string | null; dealsFound: number }>(
      `${environment.apiUrl}/health`,
    );
  }
}
