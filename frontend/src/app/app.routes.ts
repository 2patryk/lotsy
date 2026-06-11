import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'deals', pathMatch: 'full' },
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
];
