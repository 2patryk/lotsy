# Lotsy — Plan v3: tanie loty w jedną stronę (last minute, 10 dni, oba kierunki)

Nowa zakładka z **najtańszymi biletami one-way** w oknie **od dziś do +10 dni**,
w **obu kierunkach**: z polskich lotnisk (PL→) **i do polskich lotnisk** (→PL).
Bierzemy pod uwagę **wszystkie realne trasy Ryanaira** z/do 8 polskich lotnisk
(bez ograniczania do wakacyjnej listy `DEST_AIRPORTS` z silnika dealów).
Źródło: API Ryanaira (już podpięte + jeden nowy endpoint, zweryfikowany
curlem 2026-07-04).

## Źródło danych — API Ryanaira (zweryfikowane)

### Nowy endpoint: lista najtańszych per trasa w oknie dat (discovery)

```
GET https://www.ryanair.com/api/farfnd/v4/oneWayFares
    ?departureAirportIataCode=WMI            (wariant PL→)
    ?arrivalCountryCode=pl&departureCountryCode=it   (wariant →PL)
    &outboundDepartureDateFrom=YYYY-MM-DD
    &outboundDepartureDateTo=YYYY-MM-DD
    &market=pl-pl&currency=PLN&limit=300&offset=0
```

→ `{ fares: [...], size }` — **jeden najtańszy lot per trasa w całym oknie**
(nie per dzień). Każdy fare: lotniska (IATA + nazwa + miasto + kraj po
polsku), `departureDate`/`arrivalDate` z godzinami, `flightNumber`, cena PLN.
Bez auth, bez paginacji przy `limit=300` (WMI: 49 tras aktywnych w 10 dni).

Fakty (przetestowane):
- `departureAirportIataCode=WAW` → 12 tras aktywnych w oknie (routes endpoint
  pokazuje 19 — trasy bez lotów w oknie po prostu nie występują → endpoint
  robi za **discovery aktywnych tras** za darmo).
- Kierunek →PL: samo `arrivalCountryCode=pl` **nie działa** („Any departure
  filter has to be provided") — trzeba dodać filtr wylotu; działa
  `departureCountryCode={cc}` (1 call na kraj) oraz
  `departureAirportIataCode(s)=...`.

### Istniejący klient (`packages/flights-client`) — bez zmian

- `getCheapestPerDay(origin, dest, y, m)` → najtańszy lot **na każdy dzień
  miesiąca** dla trasy, z godzinami. Działa w obu kierunkach (dowolne IATA).
- `getDestinations(origin)` / `RouteCache` (TTL 24 h) — pełna lista tras per
  lotnisko (do →PL używamy odwrotności: trasy Ryanaira są symetryczne).

### Strategia odpytywania (2 fazy)

1. **Discovery (tanio):** endpoint listowy — 8 calli PL→ (per polskie
   lotnisko) + ~25 calli →PL (per kraj wylotu; lista krajów = kraje widziane
   w wynikach PL→). Wynik: zbiór **aktywnych tras w oknie** + nazwy
   miast/krajów po polsku (do UI, bez własnego słownika).
2. **Per dzień (docelowe wiersze):** `cheapestPerDay` tylko dla aktywnych
   tras, w obu kierunkach; okno 10 dni = 1–2 miesiące kalendarzowe.
   Szacunek: ~180–250 aktywnych tras × 2 kierunki × 1–2 mies. ≈
   **~400–900 calli/run** — porównywalnie z głównym silnikiem, OK przy co 3 h.
   Rate limiting jak wszędzie (3 równoległe, 300 ms, retry z backoffem).

## Zakres MVP

Zakładka **„W jedną stronę"**: płaska lista (1 wiersz = najtańszy lot danego
dnia na trasie), przełącznik kierunku **PL→ / →PL**, sort domyślnie cena
rosnąco. Okno stałe: dziś → +10 dni (`ONEWAY_HORIZON_DAYS = 10` w configu,
łatwe do podniesienia). 1 pasażer, tylko Ryanair (loty bezpośrednie).

- **Bez progu cenowego w silniku** — zapisujemy całe okno
  (~250 tras × ≤10 dni × 2 kierunki ≈ maks. kilka tys. wierszy);
  filtr ceny robi user w UI.
- Model **latest-only** (transakcyjny replace, jak `CharterFlight`) —
  bez historii cen w MVP.
- Link „Sprawdź" = URL wyszukiwania Ryanair
  (`.../trip/flights/select?adults=1&dateOut=YYYY-MM-DD&originIata=...&destinationIata=...&isReturn=false`).

## Integracja z istniejącą infrą

1. **DB (`packages/db`)**: model `OneWayFare`:
   `id`, `direction` (`"OUT"` PL→ | `"IN"` →PL), `origin`, `originCity`,
   `originCountry`, `destination`, `destCity`, `destCountry`,
   `date`, `departureTime`, `arrivalTime`, `flightNumber?`, `price`,
   `currency`, `updatedAt`;
   `@@unique([origin, destination, date])`, indeksy po
   `[direction, price]` i `[direction, date]`.
   Nazwy miast/krajów bierzemy z fazy discovery (fallback: tabela `Airport`).
2. **flights-client**: nowa funkcja `getOneWayFaresList(params)` dla
   endpointu listowego (+ typy z realnej odpowiedzi).
3. **Engine (`engine/src/oneway.ts`)**: osobny skrypt —
   discovery (8 + ~25 calli) → `cheapestPerDay` per aktywna trasa × kierunek
   × miesiąc(e) → filtr dat `[dziś, dziś+10]` → transakcyjny replace +
   wpis `SearchRun`. Skrypty: `smoke:oneway` (`--dry-run`) i `start:oneway`.
4. **Workflow GH Actions (`oneway.yml`)**: cron co 3 h (offset :45 względem
   `search` i `charters`) + `workflow_dispatch`, timeout z zapasem (~30 min).
5. **API (`api/src/oneway`)**:
   `GET /oneway/fares?direction=out|in&origin=&destCountry=&dateFrom=&dateTo=&days=&maxPrice=&sort=price|date`
   (cap ~300, dni tygodnia w JS — jak w charters) +
   `GET /oneway/meta` (lotniska, kraje, zakres dat — per kierunek).
6. **Frontend**: route `/jedna-strona` + link w nav; lista wierszy jak w
   Czarterach: **data + godzina + lotnisko** (badge), trasa, cena, chip
   Ryanair; przełącznik kierunku PL→ / →PL; filtry: lotnisko PL (multi),
   kraj po drugiej stronie (multi), zakres dat, dni tygodnia, maks. cena;
   „Sprawdź" → deep link Ryanair.

## Kroki

- [ ] 1. Prisma: model `OneWayFare` + migracja + generate.
- [ ] 2. flights-client: `getOneWayFaresList` (endpoint listowy, oba warianty
      filtrów) + typy + smoke test.
- [ ] 3. Engine: `oneway.ts` (discovery → cheapestPerDay oba kierunki →
      okno 10 dni → replace) + `--dry-run`; log do `SearchRun`.
- [ ] 4. Workflow GH Actions `oneway.yml` (co 3 h, offset :45).
- [ ] 5. API: moduł `oneway` (`GET /oneway/fares`, `GET /oneway/meta`).
- [ ] 6. Frontend: model + serwis + strona `/jedna-strona` + przełącznik
      kierunku + filtry + deep link Ryanair + link w nav.
- [ ] 7. Weryfikacja end-to-end lokalnie (engine → Neon → API → strona).

## Poza zakresem (pomysły na później)

- Rozszerzenie okna (np. 30 dni) lub konfigurowalne w UI.
- Historia cen i alerty spadków (wspólnie z krokiem 3 z planu v2).
- Wizzair jako drugie źródło (blokada 403 — patrz PLAN.md, Faza 2b).
- Tryb „tania wycieczka": parowanie taniego PL→ z tanim →PL na tej samej
  trasie (de facto round-trip z dwóch one-way — silnik dealów robi to już
  dla wzorca weekendowego; tu byłoby bez wzorca).
