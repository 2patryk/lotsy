# Lotsy — Plan v2: zakładka Czartery (Rainbow / r.pl)

Rozszerzenie lotsy o drugą kategorię ofert: **bilety na loty czarterowe Rainbow**
(https://r.pl/bilety-czarterowe). Plan przeniesiony z osobnego projektu
`rainbow-charter-tracker` — zamiast nowej apki wykorzystujemy istniejącą infrę
(engine na GH Actions, NestJS API, Angular frontend, Neon + Prisma).

## Źródło danych: publiczne JSON API r.pl (zweryfikowane)

Strona to Nuxt SSR, ale dane pochodzą z publicznego API na `r.pl`.
**Bez ciasteczek, bez sesji, bez podpisywania** — wystarczy przeglądarkowy
`User-Agent`. Odpowiedzi to czysty JSON.

### Endpoint przeglądowy (MVP używa tylko tego)

```
GET https://r.pl/api/czartery/wyszukiwanie/v4.1/wyszukaj
    ?oneWay=true|false
    &dataUrodzenia=YYYY-MM-DD   (1× na pasażera; ceny są per osoba)
    &sortowanie=cena
```

→ `{ Destynacje: [~61-64 pozycji], Filtry }` — **wszystkie destynacje w jednej
odpowiedzi, bez paginacji** (parametr `strona` na stronie WWW tylko rotuje
wyróżniony przykład wylotu). Każda destynacja: `Panstwo`, `PanstwoUrl`, `Nazwa`,
`NazwaUrl`, `Klucz` (IATA), `Cena` (najniższa), `TerminWyjazdu`, `Bagaz`,
zdjęcia, geo.

Kluczowe fakty (przetestowane curlem):

- `oneWay=true` → `Cena` = najtańszy bilet **w jedną stronę** za osobę.
- `oneWay=false` → `Cena` = najtańsza cena **w obie strony** za osobę.
- Zbiory destynacji lekko się różnią między wariantami (61 vs 64) — łączymy po
  `Klucz`, brakująca cena = null.
- `Cena` to minimum **po wszystkich lotniskach wylotu** — przegląd nie mówi
  wiarygodnie, z którego lotniska (pole `DataLayer.name` zawiera trasę
  przykładu, ale rotuje między pobraniami → nie używać).

**Pełny snapshot MVP = 2 calle do API** (oneWay=false + oneWay=true).

### Endpointy szczegółowe (poza MVP, na krok 2)

- `GET /api/czartery/destynacja/v4.1/wyszukaj-wylot?iataDokad=HER&dataMin=...&dataMax=...&oneWay=...&dataUrodzenia=...`
  — przyjmuje dowolnie szeroki zakres dat → **1 call na destynację** zwraca
  wszystkie konkretne loty (dzień, lotnisko wylotu, godziny, przewoźnik, numer
  lotu, bagaż, cena). Pełna siatka per lotnisko: ~62 calle.
- `GET /api/czartery/destynacja/v4.1/wyszukaj-przylot?pakietId=...&dataUrodzenia=...`
  — powroty dla wybranego wylotu; **1 call per lot wylotowy** → pełne parowanie
  wylot+powrót jest drogie, robić tylko on-demand.
- `GET /api/czartery/destynacja/v4.1/wykres?iataDokad=...` — min. cena per
  miesiąc (zbędne, skoro wyszukaj-wylot łyka szeroki zakres).
- Uwaga: przy `oneWay=false` cena biletu wylotowego jest niższa (część pakietu),
  a `CenaRazem` = cena × liczba pasażerów (NIE cena w obie strony).

## Zakres MVP

Zakładka **„Czartery"** w lotsy: lista najtańszych kierunków czarterowych
posortowana od najtańszego, z ceną w obie strony i w jedną stronę, bez
rozróżnienia lotniska wylotu. Konfiguracja pasażera: 1 dorosły (spójnie z
resztą lotsy; data urodzenia liczona dynamicznie ~30 lat wstecz).

## Integracja z istniejącą infrą

1. **DB (`packages/db`)**: nowy model `CharterOffer` — latest-only upsert po
   `destIata` (bez historii cen w MVP):
   `destIata` (PK), `destName`, `destCountry`, `destCountryUrl`, `destNameUrl`,
   `priceRoundTrip?`, `priceOneWay?`, `nearestDeparture?`, `baggageKg?`,
   `imageUrl?`, `updatedAt`.
2. **Engine (`engine/src/charters.ts`)**: osobny skrypt — 2 calle do r.pl,
   merge po `Klucz`, transakcyjny replace tabeli. Uruchamiany osobnym
   workflow GH Actions (`charters.yml`, co 3h + `workflow_dispatch`).
3. **API (`api/src/charters`)**: `GET /charters` — lista z DB, sort po cenie
   rosnąco (`sort=roundTrip|oneWay`), opcjonalny filtr `country`.
4. **Frontend**: route `/czartery` + link „Czartery" w nawigacji headera;
   strona z listą kart: kierunek, kraj, cena RT / OW, zdjęcie, link do
   `https://r.pl/bilety-czarterowe/{panstwoUrl}/{nazwaUrl}`.

## Kroki

- [x] Rozpoznanie API r.pl (curl, bundle JS) — wyniki wyżej.
- [x] 1. Prisma: model `CharterOffer` + migracja + generate.
- [x] 2. Engine: `charters.ts` (fetch 2 calli, merge, replace) + `--dry-run`
      (`pnpm --filter @lotsy/engine smoke:charters` / `start:charters`).
- [x] 3. Workflow GH Actions `charters.yml` (co 3h, offset :30 względem search).
- [x] 4. API: moduł `charters` (`GET /charters?sort=roundTrip|oneWay&country=`).
- [x] 5. Frontend: model + serwis + `charters-page.component` + route `/czartery`
      + link „Czartery" w nav.
- [x] 6. Weryfikacja end-to-end lokalnie (engine → Neon → API → strona,
      2026-07-03: 75 destynacji, sort i przełącznik RT/OW działają).

## Krok 2 (poza MVP)

- Rozbicie per lotnisko wylotu (`wyszukaj-wylot`, +~61 calli): konkretne daty,
  numery lotów, przewoźnicy.
- Historia cen (append-only snapshot) i alerty spadków.
- Parowanie wylot+powrót on-demand w UI (`wyszukaj-przylot`).
