import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'jedna-strona', pathMatch: 'full' },
  {
    path: 'deals',
    loadComponent: () =>
      import('./features/deals/deals-page.component').then((m) => m.DealsPageComponent),
  },
  {
    path: 'deals/saved',
    loadComponent: () =>
      import('./features/saved/saved-deals-page.component').then((m) => m.SavedDealsPageComponent),
  },
  {
    path: 'czartery',
    loadComponent: () =>
      import('./features/charters/charters-page.component').then((m) => m.ChartersPageComponent),
  },
  {
    path: 'jedna-strona',
    loadComponent: () =>
      import('./features/oneway/oneway-page.component').then((m) => m.OneWayPageComponent),
  },
];
