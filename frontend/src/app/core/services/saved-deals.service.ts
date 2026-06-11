import { Injectable, signal, computed } from '@angular/core';
import type { Deal } from '../models/deal.model';

const STORAGE_KEY = 'lotsy_saved_deals';
const TTL_MS = 48 * 60 * 60 * 1000;

interface SavedDeal {
  deal: Deal;
  savedAt: number;
}

@Injectable({ providedIn: 'root' })
export class SavedDealsService {
  private _saved = signal<SavedDeal[]>(this.loadFromStorage());

  readonly savedDeals = computed(() => this._saved());
  readonly savedIds = computed(() => new Set(this._saved().map((s) => s.deal.id)));

  isSaved(id: string) {
    return this.savedIds().has(id);
  }

  toggle(deal: Deal) {
    if (this.isSaved(deal.id)) {
      this.remove(deal.id);
    } else {
      this.save(deal);
    }
  }

  private save(deal: Deal) {
    const next = [...this._saved(), { deal, savedAt: Date.now() }];
    this._saved.set(next);
    this.persist(next);
  }

  private remove(id: string) {
    const next = this._saved().filter((s) => s.deal.id !== id);
    this._saved.set(next);
    this.persist(next);
  }

  private loadFromStorage(): SavedDeal[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed: SavedDeal[] = JSON.parse(raw);
      // Filter out TTL-expired snapshots
      return parsed.filter((s) => Date.now() - s.savedAt < TTL_MS);
    } catch {
      return [];
    }
  }

  private persist(items: SavedDeal[]) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }
}
