# Lotsy — Plan projektu

## Cel

Serwis do znajdowania atrakcyjnych krótkich wyjazdów z Polski. System automatycznie (bez konfiguracji przez użytkownika) co kilka godzin przeszukuje loty z polskich lotnisk do popularnych destynacji wakacyjnych, szukając "złotego wzorca": wylot czwartek wieczór / piątek rano lub wieczór, powrót niedziela lub poniedziałek wieczorem, wyjazd 3–7 dni. Użytkownik wchodzi i od razu widzi gotowe, atrakcyjne oferty (bez logowania w MVP).

---

## Ustalenia MVP (wywiad projektowy)

Decyzje przyjęte świadomie — **źródło prawdy** dla reszty dokumentu. Gdzie sprzeczne ze starszym opisem, obowiązuje ta lista.

**Produkt i zakres:**
1. **Cel:** publiczny, ale minimalny — `/deals` dostępne bez logowania, mała skala, bez SSR/SEO na start.
2. **Auth:** brak w MVP. „Zapisz" w `localStorage`.
3. **Pasażerowie:** stała 1 osoba (`totalPrice == pricePerPerson`).
4. **Przewoźnicy:** **Ryanair pierwszy** (stabilne, zweryfikowane API). Wizz + **mix & match** = drugi krok fazy 2.
5. **Start na małym podzbiorze tras** (np. WAW/WMI/KRK × FCO/CIA/BCN/ATH/NAP), potem rozszerzenie do pełnej mapy.
6. **Tylko loty bezpośrednie** (`stops = 0`).
7. **Język:** tylko polski (zero i18n-infra).

**Wzorzec i silnik:**
8. **`cheapestPerDay` zwraca godziny lotu** (zweryfikowane) → **etap 2 (`availability`) NIE jest potrzebny w MVP**.
9. **Filtr godzinowy = miękki:** twardy warunek to wzorzec **dat** (wylot czw/pt/sob, powrót niedz/pon/sob, 3–7 nocy); godzina wpływa na **scoring/sortowanie** (wieczorne wyżej), nie odrzuca lotów.
10. **Próg atrakcyjności:** stały limit kwotowy w configu (np. round-trip ≤ 600–800 zł/os).
11. **Limit:** top 3 najtańsze kombinacje per trasa.
12. **Horyzont:** kroczące ~6 tygodni (bieżący + następny miesiąc).
13. **Mapa lotnisko↔przewoźnik NIE jest hardcodowana** — realne trasy z endpointu `routes/destinations`, cache.
14. **Link rezerwacji:** skonstruowany URL wyszukiwania Ryanair (bez `availability`).

**Infrastruktura i operacje:**
15. **Monorepo:** pnpm workspaces (bez Nx/Turbo).
16. **Hosting:** API NestJS na Render free; frontend na Cloudflare Pages; DB na Neon.
17. **Silnik:** skrypt TS na GitHub Actions, **zapis wprost do Neon przez Prisma**. Repo **prywatne** na GitHub.
18. **Cron:** dev — ręcznie (`workflow_dispatch`); prod — co 3 h.
19. **Ryzyko IP datacenter (GH Actions):** akceptujemy + realistyczne nagłówki + monitoring; plan B = mały VPS/Oracle Always Free, gdyby blokady.
20. **Health/„ostatnia aktualizacja":** tabela `SearchRun` (czas, #ofert, status). Alert = **fail workflow GH Actions → e-mail**.

**Frontend i dane:**
21. **UI:** Angular Material + lekki custom theme.
22. **Filtry v1:** kraj (multi) + maks. cena (slider) + lotnisko wylotu (multi); sort domyślnie cena rosnąco.
23. **Dostarczanie:** API zwraca całość (cap ~200), filtr/sort/paginacja **po stronie klienta** (signals).
24. **Zapisane:** pełny **snapshot** deala + link w `localStorage` (przetrwa 48h TTL; znacznik „cena może być nieaktualna").
25. **Testy:** unit na czystej logice silnika (parowanie dat, liczenie nocy, mix & match cen); reszta — smoke ręczny.

---

## Złoty wzorzec lotu (hardcoded w systemie)

### Lotniska wylotu (Polska)
`WAW, WMI, KTW, KRK, GDN, WRO, POZ, LCJ`

> **Warszawa ma dwa lotniska:** WAW (Chopin) i WMI (Modlin). **Oba** obsługuje Ryanair (zweryfikowane: `WAW→AGP` i `WMI→CIA` mają realne taryfy), a WAW dodatkowo Wizz/LOT. Konkretne trasy zależą od pary miast (np. `WAW→CTA` Ryanair nie lata) — dlatego **nie hardcodujemy mapy lotnisko↔przewoźnik**, tylko pobieramy realne trasy per przewoźnik z endpointu `routes/destinations` i cache'ujemy (patrz Źródło danych).

> **MVP:** wylot i powrót na **to samo** polskie lotnisko (klasyczny round-trip).
> **MVP 2 (open-jaw):** powrót na **inne** polskie lotnisko niż wylot (np. tam z WAW, z powrotem do KRK). Wymaga osobnej logiki (dwa one-way zamiast round-trip — patrz Otwarte kwestie #8) i będzie **osobnym filtrem** w UI (domyślnie wyłączony, żeby nie mieszać userowi).

### Destynacje
| Kraj | Lotniska |
|---|---|
| Włochy | FCO, MXP, NAP, BLQ, VCE, PSA |
| Hiszpania | BCN, MAD, AGP, PMI, ALC, SVQ |
| Grecja | ATH, HER, RHO, SKG, CFU |
| Chorwacja | SPU, DBV, ZAD |
| Albania | TIA |
| Czarnogóra | TGD, TIV |
| Portugalia | LIS, OPO, FAO |
| Malta | MLA |
| Cypr | LCA, PFO |
| Turcja | AYT, IST, ESB |
| Bułgaria (wybrzeże) | VAR, BOJ |
| Francja (południe) | NCE, MRS |

> **Uwaga:** lista par lotnisk to teoretyczny maks. W praktyce realnie obsługiwane są tylko trasy, które dany przewoźnik (Ryanair / Wizzair) faktycznie lata. Listę realnych tras pobieramy raz z API przewoźnika (endpoint `routes/destinations`) i cache'ujemy — dzięki temu nie marnujemy zapytań na nieistniejące połączenia (np. WAW→CTA, które w teście zwróciło `unavailable`).

### Wzorzec czasowy
**Wylot (outbound):**
- Czwartek: od 16:00
- Piątek: od 06:00 do 23:59
- Sobota: od 06:00 do 12:00 (dla wyjazdów tygodniowych)

**Powrót (return):**
- Niedziela: od 16:00
- Poniedziałek: od 16:00
- Sobota: od 14:00 (dla wyjazdów tygodniowych)

**Długość wyjazdu:** 3–7 **nocy** (liczymy noce, nie doby — patrz Otwarte kwestie #4)

### Przykładowe kombinacje dat
- Czw wieczór → Niedz wieczór = 3 noce ✓
- Czw wieczór → Pon wieczór = 4 noce ✓
- Pt wieczór → Niedz wieczór = 2 noce (krótki) ✓
- Pt wieczór → Pon wieczór = 3 noce ✓
- Sob rano → Sob popołudniu (tydzień później) = 7 nocy ✓

---

## Źródło danych o lotach — API przewoźników (NIE scraping)

> **Decyzja kluczowa:** Rezygnujemy ze scrapowania Google Flights (`fli`). Powód: ~20 000 zapytań/dobę z jednego IP = gwarantowany ban, biblioteka bez SLA, łamanie ToS. Zamiast tego odpytujemy **API przewoźników**, które dominują na naszych trasach (PL → płd. Europa to w ~85% Ryanair + Wizzair).

> **Model „mix & match":** outbound i return traktujemy **niezależnie** i pulujemy oferty **obu przewoźników razem**. Dla danej pary dat bierzemy najtańszy wylot (Ryanair **lub** Wizz) + najtańszy powrót (Ryanair **lub** Wizz) — mogą to być **różni przewoźnicy** (tam Ryanair, z powrotem Wizz). Dlatego pracujemy na **cenach one-way per dzień**, nie na round-trip.

### Ryanair — Fare Finder (bez autoryzacji)
- **One-way cheapest-per-day (etap 1, główny):**
  `GET https://www.ryanair.com/api/farfnd/v4/oneWayFares/{from}/{to}/cheapestPerDay?outboundMonthOfDate=YYYY-MM-01&currency=PLN`
  Zwraca najtańszy lot one-way na każdy dzień miesiąca:
  ```json
  { "outbound": { "fares": [ { "day": "2026-07-03", "departureDate": "2026-07-03T19:45:00", "arrivalDate": "...", "price": { "value": 149.99, "currencyCode": "PLN" }, "soldOut": false, "unavailable": false } ] } }
  ```
  Wołane **dwukierunkowo**: `origin→dest` (wyloty) i `dest→origin` (powroty) — dwa zapytania one-way na trasę, poolowane z Wizzem.
  **Jedno wywołanie = cena najtańszego lotu na każdy dzień miesiąca w jednym kierunku.** Eliminuje brute-force po parach dat.
  > _(Endpoint `roundTripFares/.../cheapestPerDay` istnieje i jest tańszy w wywołaniach, ale wiąże oba kierunki z Ryanairem — używamy go tylko jako optymalizację dla dealów „czysto Ryanair", patrz Strategia.)_
- **Availability (etap 2, doostrzenie godzin):**
  `GET https://www.ryanair.com/api/booking/v4/pl-pl/availability?...` — zwraca konkretne loty z godzinami dla wybranego dnia. Wołane **tylko** dla najtańszych kandydatów (po to, by zastosować filtr godzinowy i wygenerować deep-link). Dużo mniejszy wolumen.

### Wizzair — Timetable (reverse-engineered, bez autoryzacji)
- `POST https://be.wizzair.com/{ver}/Api/search/timetable`
  Body z trasą + zakresem dat → zwraca loty **od razu z godzinami i cenami** w jednym wywołaniu (nie potrzeba etapu 2).
  ⚠️ Wymaga aktualnego `{ver}` (wersja API w URL zmienia się; pobrać dynamicznie ze strony lub trzymać w configu z fallbackiem).

### Strategia odpytywania (oszczędna)
1. Cache realnych tras per przewoźnik (odśwież raz dziennie).
2. **Etap 1 — zbierz pulę one-way per dzień, w obu kierunkach, z obu przewoźników:**
   - Ryanair: `oneWayFares` dla `origin→dest` (wyloty) **i** `dest→origin` (powroty).
   - Wizz: `timetable` dla obu kierunków (od razu z godzinami).
   - ~210 tras × (2 kierunki Ryanair + 2 Wizz) ≈ **~840 wywołań/run** w wariancie pełnego mixu. Optymalizacja: dla tras, gdzie **tylko jeden** przewoźnik lata (z cache tras), wracamy do round-trip / jednego źródła.
3. **Złóż dealy (mix & match):** dla każdej pary dni wg wzorca (wylot czw/pt/sob + powrót niedz/pon/sob, 3–7 nocy):
   - `cenaTam = min(Ryanair[outDay], Wizz[outDay])`
   - `cenaPowrót = min(Ryanair[retDay], Wizz[retDay])`
   - `total = cenaTam + cenaPowrót`; zapamiętaj który przewoźnik wygrał każdy kierunek. Weź najtańsze N per trasa.
4. **Etap 2 — doostrzenie godzin** tylko dla najtańszych kandydatów:
   - Ryanair (wygrany kierunek): `availability` → godziny + deep-link.
   - Wizz: godziny już są z etapu 1.
   - Zastosuj filtr godzinowy. ~50–150 wywołań/run.
5. Upsert do bazy, ustaw `expiresAt`, posprzątaj wygasłe **oraz loty już odbyte** (`departAt < now()`).

**Łącznie ~900–1000 wywołań/run** (wciąż znacznie poniżej ~1680 ze scrapingu, i do API a nie scrapera) → bezpieczne przy interwale ~3 h.

### Fallback / rozszerzenie
- **Kiwi Tequila API** — oficjalne, model „virtual interlining" (suma dwóch tanich one-way) idealnie pasuje; wymaga zatwierdzenia afiliacyjnego. Dobry fallback dla tras nie-LCC (np. część Grecji/Turcji).
- **Amadeus Self-Service** — oficjalne, darmowy tier, ale środowisko testowe ma niepełne dane.

---

## Stack technologiczny

| Warstwa | Technologia | Uzasadnienie |
|---|---|---|
| Frontend | Angular 19 + Angular Material | Standalone components, signals, nowy router |
| Backend API | NestJS (TypeScript) | Lekki, **read-only** nad bazą; gotowy na dodanie auth później |
| Silnik wyszukiwania | Skrypt TS (współdzielony pakiet) uruchamiany przez **GitHub Actions cron** | Brak potrzeby always-on serwera; przeżywa usypianie darmowego hostingu |
| Klient lotów | Własny moduł TS: Ryanair Fare Finder + Wizz Timetable | Zero scrapingu, zero Pythona, jeden język |
| Baza danych | PostgreSQL na **Neon** | Darmowy tier, serverless, branching |
| ORM | Prisma | Type-safe, łatwe migracje, współdzielony przez API i silnik |
| Auth | **brak w MVP** | „Zapisz" trzymamy w `localStorage`; auth dodajemy gdy będą userzy |
| Hosting API | Cloud Run (scale-to-zero) lub Render free | API bezstanowe; cold start akceptowalny |
| Hosting frontend | Cloudflare Pages / Vercel | Darmowe bezterminowo |
| Hosting DB | Neon | Darmowy PostgreSQL serverless |
| Scheduler | GitHub Actions (cron co ~3 h) | Darmowy, nie wymaga żywego serwera |

> **Uwaga o nieaktualności:** Railway **nie ma już darmowego planu** (od 2023 to płatne Hobby) — dlatego go nie używamy. `@nestjs/schedule` (cron in-process) **nie zadziała** na hostingach usypiających serwis po bezczynności (Render free) — dlatego scheduler przenosimy do GitHub Actions.

---

## Architektura

```
┌─────────────────────┐        ┌──────────────────────────────┐
│  Angular 19 SPA     │ ──────▶│      NestJS API (read-only)  │
│  (Cloudflare Pages) │        │  ┌────────────────────────┐  │
│  save → localStorage│        │  │   DealsModule (GET)    │  │
└─────────────────────┘        │  └───────────┬────────────┘  │
                               └──────────────┼───────────────┘
                                              │ czyta
                                   ┌──────────▼───────────┐
                                   │  PostgreSQL (Neon)   │
                                   └──────────▲───────────┘
                                              │ upsert
        ┌─────────────────────────────────────┴───────────────────┐
        │   Silnik wyszukiwania (skrypt TS) — GitHub Actions cron  │
        │   1. cache tras  2. Ryanair cheapestPerDay (cena+godzina)│
        │   3. składanie par wg wzorca + scoring + próg/top3       │
        │   4. upsert Deal + czyszczenie  5. log SearchRun         │
        └─────────────────────────────────────────────────────────┘
```

Brak osobnego sidecara Python i brak HTTP NestJS↔sidecar — silnik to skrypt TS współdzielący Prisma i moduł klienta lotów z API.

---

## Schemat bazy danych

```prisma
// Atrakcyjny wyjazd znaleziony automatycznie przez silnik
model Deal {
  id              String   @id @default(cuid())

  // true gdy wylot i powrót to różni przewoźnicy (UI = "dwa osobne bilety")
  mixedCarrier    Boolean  @default(false)

  // Wylot
  originAirport   String   // "WAW"
  originCountry   String   // "PL"
  departAt        DateTime // czas LOKALNY lotniska wylotu (patrz Otwarte kwestie #5)

  // Powrót
  destAirport     String   // "FCO"
  destCountry     String   // "IT"
  returnAt        DateTime // czas lokalny lotniska docelowego

  nights          Int      // 3–7 (liczba nocy)

  // Cena (suma tam + powrót, dla 1 os.)
  totalPrice      Float
  currency        String   @default("PLN")
  pricePerPerson  Float

  // Wylot — niezależny przewoźnik (mix & match)
  outboundSource   String   // "RYANAIR" | "WIZZAIR" | "KIWI"
  outboundAirline  String
  outboundPrice    Float
  outboundFlightNo String?
  outboundStops    Int      @default(0)
  outboundBookingUrl String? // deep-link do tego konkretnego lotu

  // Powrót — niezależny przewoźnik (może być inny niż wylot)
  returnSource     String
  returnAirline    String
  returnPrice      Float
  returnFlightNo   String?
  returnStops      Int      @default(0)
  returnBookingUrl String?

  foundAt         DateTime @default(now())
  expiresAt       DateTime // foundAt + 48h; potem usuwamy

  // Klucz do UPSERT — jedna oferta na (trasa, para dat, kombinacja przewoźników)
  @@unique([originAirport, destAirport, departAt, returnAt, outboundSource, returnSource])
  @@index([destCountry, totalPrice])
  @@index([expiresAt])
  @@index([departAt])     // czyszczenie + filtr "tylko przyszłe loty"
}

// Metadane przebiegu silnika — "ostatnia aktualizacja" + health/alerty
model SearchRun {
  id           String   @id @default(cuid())
  startedAt    DateTime @default(now())
  finishedAt   DateTime?
  status       String   // "SUCCESS" | "FAILED" | "PARTIAL"
  dealsFound   Int      @default(0)
  routesQueried Int     @default(0)
  errorMessage String?
  @@index([startedAt])
}
```

> Modele `User` i `SavedDeal` **usunięte z MVP** (brak auth). Dodamy je razem z `AuthModule`, gdy pojawi się realna potrzeba kont.
> API czyta `SearchRun` (ostatni `SUCCESS`) do znacznika „ostatnia aktualizacja"; brak świeżego udanego runu = sygnał awarii.

---

## Moduły NestJS (API)

### `DealsModule` (read-only)
- `GET /deals` — lista aktualnych dealów (warunek bazowy: `expiresAt > now()` **i** `departAt > now()` — nie pokazujemy wygasłych ani już odbytych lotów), z filtrowaniem:
  - `?destCountry=IT,ES,GR`
  - `?maxPrice=1500`
  - `?sort=price|departure|duration`
  - `?origin=WAW,KTW` — lotnisko wylotu (w MVP = też lotnisko powrotu)
  - _(MVP 2)_ `?openJaw=true` + `?returnTo=KRK` — powrót na inne polskie lotnisko
- `GET /deals/:id` — szczegóły deala
- `GET /health` — health check

To w MVP praktycznie całe API. NestJS jest tu z zapasem na przyszły `AuthModule`.

---

## Silnik wyszukiwania (skrypt TS, GitHub Actions)

Uruchamiany cronem co ~3 h (`.github/workflows/search.yml`); w dev ręcznie (`workflow_dispatch`). Zapisuje wprost do Neon przez Prisma. Kroki:
0. **Otwórz `SearchRun`** (`status=PARTIAL`, `startedAt`).
1. Załaduj/odśwież cache realnych tras per przewoźnik (`routes/destinations`) — **bez hardcodowania** mapy lotnisko↔przewoźnik.
2. Wyznacz okno **~6 tygodni** → miesiące do zapytania (`outboundMonthOfDate` bieżący + następny).
3. **Pobierz ceny+godziny one-way, oba kierunki** dla każdej realnej pary (origin, dest):
   - **MVP — tylko Ryanair:** `oneWayFares/cheapestPerDay` dla `origin→dest` i `dest→origin`. Zwraca cenę **i godzinę** najtańszego lotu/dzień (zweryfikowane) — **bez osobnego etapu `availability`**.
   - **Faza 2 — dołóż Wizz** `timetable` (obu kierunków) i **mix & match** (najtańszy wylot i powrót niezależnie; `mixedCarrier=true` gdy różni przewoźnicy).
4. **Złóż dealy:** dla każdej pary dni pasującej do wzorca **dat** (wylot czw/pt/sob, powrót niedz/pon/sob, **3–7 nocy**) policz `total`. Odrzuć `stops>0` i `total > próg` (config). **Scoring godzinowy** (wieczorne wyloty/powroty wyżej) decyduje o kolejności, **nie** odrzuca. Zostaw **top 3 najtańsze per trasa**.
5. **Upsert** `Deal` po kluczu `@@unique` (aktualizuje cenę zamiast tworzyć duplikat), `expiresAt = now + 48h`, `outboundBookingUrl`/`returnBookingUrl` = skonstruowane URL-e wyszukiwania Ryanair. Nie zapisuj par z `departAt` w przeszłości lub < ~24h.
6. **Czyszczenie** — usuń `Deal` gdzie `expiresAt < now()` **lub** `departAt < now()`.
7. **Zamknij `SearchRun`** (`status=SUCCESS`, `finishedAt`, `dealsFound`, `routesQueried`). Przy wyjątku lub 0 ofert mimo żywych tras → `status=FAILED` i **zakończ workflow błędem** (GitHub wyśle maila).

**Rate limiting / dobre maniery:** max 3 równoległe requesty, delay ~300 ms, realistyczne nagłówki (`User-Agent`, `Accept-Language` jak przeglądarka — ważne wobec IP datacenter GH Actions), retry z exponential backoff (3 próby). Graceful: błąd jednej trasy nie wywala całego runu. **Plan B**, gdyby pojawiły się blokady 403/429: przenieść silnik na mały VPS / Oracle Always Free.

---

## Frontend Angular 19

### Strony
```
/              → redirect → /deals
/deals         → główna strona z dealami (publiczna)
/deals/saved   → zapisane (z localStorage; bez logowania)
```

### Widok `/deals` — główna wartość produktu
```
┌─────────────────────────────────────────────────────┐
│  Lotsy                                              │
├─────────────────────────────────────────────────────┤
│  Filtruj: [Kraj: wszystkie ▾] [Cena: do 2000zł ▾]  │
│           [Wylot z: wszystkich ▾] [Sortuj: cena ▾] │
├─────────────────────────────────────────────────────┤
│ ┌──────────────────────┐ ┌─────────────────┐       │
│ │ 🇮🇹 Rzym              │ │ 🇪🇸 Barcelona    │       │
│ │ WAW → FCO             │ │ KTW → BCN       │       │
│ │ Pt 3.07 19:45 ✈Ryan  │ │ Czw 2.07 17:20  │       │
│ │ Niedz 5.07 21:00 ✈Wzz│ │ Pon 6.07 20:15  │       │
│ │ 3 noce • 🔀 2 bilety  │ │ 4 noce • Wizz   │       │
│ │ ★ 349 zł/os (149+200)│ │ ★ 412 zł/os    │       │
│ │ [♡] [↗ tam] [↗ powr.]│ │ [♡ Zapisz] [↗] │       │
│ └──────────────────────┘ └─────────────────┘       │
│                   Ostatnia aktualizacja: 14 min temu│
└─────────────────────────────────────────────────────┘
```
`[↗]` = deep-link do rezerwacji. Przy `mixedCarrier` (różni przewoźnicy tam/z powrotem) karta pokazuje znacznik **„🔀 2 bilety"**, rozbicie ceny (tam+powrót) i **dwa osobne linki** do rezerwacji.

### Kluczowe komponenty
- `DealCardComponent` — karta oferty (flaga, lotniska, daty, cena, save). Obsługuje `mixedCarrier`: znacznik „2 bilety", rozbicie `outboundPrice`/`returnPrice`, dwa linki (`outboundBookingUrl`, `returnBookingUrl`). Dla jednego przewoźnika — jeden link.
- `DealFiltersComponent` — kraj (multi-select), maks. cena (slider), lotnisko wylotu. Sort domyślnie cena rosnąco.
- `DealsGridComponent` — siatka kart. **Dane: jeden request po całość (cap ~200), filtr/sort/„pokaż więcej" po stronie klienta** (signals w pamięci) — bez paginacji w API.
- `SavedDealsPageComponent` — zapisane z `localStorage` (serwis `SavedDealsService` na `signal` + `localStorage`). **Pełny snapshot oferty** (nie ID), znacznik „cena może być nieaktualna".

> **Wygląd:** Angular Material + lekki custom theme (paleta/typografia/zaokrąglenia), żeby nie wyglądało generycznie. UI po polsku.

---

## Fazy implementacji

> **Śledzenie postępu — reguła:** patrz [Zasady prowadzenia planu](#zasady-prowadzenia-planu-postęp). W skrócie: każdą pozycję oznaczamy `- [ ]` → `- [x]`, dopisując `(✅ RRRR-MM-DD)`. Zadania w toku: `- [~] … (🚧 w toku: krótka notatka)`. Zablokowane: `- [!] … (⛔ blokada: powód)`. Status fazy aktualizujemy w nagłówku.

### Faza 1 — Fundament _(Status: ✅ ukończona)_
- [x] Struktura monorepo (pnpm workspaces): `api/` (NestJS), `engine/` (skrypt), `frontend/`, `packages/flights-client/`, `packages/db/` (Prisma współdzielony) (✅ 2026-06-11)
- [x] Prisma: schemat `Deal` + `SearchRun`, migracja na Neon (✅ 2026-06-11)
- [x] `flights-client`: klient **Ryanair** (`oneWayFares/cheapestPerDay`, `routes/destinations`) — typy z prawdziwych odpowiedzi (zwraca ceny **i godziny**) (✅ 2026-06-11)
- [x] Smoke test na realnych trasach (`WMI→CIA`, `KRK→BCN`, `WAW→AGP`) — API zwraca realne ceny z godzinami (✅ 2026-06-11)

### Faza 2 — Silnik wyszukiwania (MVP: Ryanair) _(Status: ✅ ukończona)_
- [x] Cache realnych tras Ryanaira (`routes/destinations`) — 120 realnych tras z 8 lotnisk (✅ 2026-06-11)
- [x] Logika składania par dni wg wzorca **dat** (czw/pt/sob → niedz/pon/sob, 3–7 nocy) + scoring godzinowy (miękki) (✅ 2026-06-11)
- [x] Próg cenowy (config 800 PLN), `stops=0`, top 3 per trasa (✅ 2026-06-11)
- [x] Upsert `Deal` + czyszczenie (`expiresAt`/`departAt`), logowanie `SearchRun` (✅ 2026-06-11)
- [x] Uruchom na małym podzbiorze tras, sprawdź realne deale w bazie — 259 dealów zapisanych do Neon, `SearchRun=SUCCESS` (✅ 2026-06-11)
- [!] **Faza 2b (po MVP):** klient Wizz (`timetable` + dynamiczny `{ver}`) + mix & match (⛔ blokada: `be.wizzair.com` zwraca 403 przez CloudFront — wymaga tokenu/cookie z sesji przeglądarki; alternatywa: Kiwi Tequila API)

### Faza 3 — API + Frontend _(Status: ✅ ukończona)_
- [x] `DealsModule`: `GET /deals` z filtrami (warunek `expiresAt>now` i `departAt>now`), `GET /deals/:id`, `/health`; znacznik „ostatnia aktualizacja" z `SearchRun` (✅ 2026-06-11)
- [x] Angular: setup, routing, Material + custom theme (PL) — indigo/amber theme, Inter font (✅ 2026-06-11)
- [x] `SavedDealsService` (localStorage + signal, pełny snapshot, TTL 48h) (✅ 2026-06-11)
- [x] `DealCardComponent` + filtry (kraj, lotnisko, cena, sort) + siatka kart (filtr/sort po stronie klienta, signals) + strona `/deals` (✅ 2026-06-11)
- [x] Strona `/deals/saved` (✅ 2026-06-11)

### Faza 4 — Deploy + Szlif _(Status: 🟡 w toku)_
- [x] Prywatne repo na GitHub `2patryk/lotsy`; `.github/workflows/search.yml` — `workflow_dispatch` + cron co 3 h (sekret `DATABASE_URL`), fail→e-mail przez GH (✅ 2026-06-11)
- [~] Deploy API (Render free) — `render.yaml` gotowy; do stworzenia serwisu w dashboardzie (🚧 w toku)
- [~] Deploy frontend (Cloudflare Pages) — `_redirects` i `fileReplacements` gotowe; do połączenia z GitHub (🚧 w toku)
- [x] DB (Neon) — już działa, migracja zastosowana (✅ 2026-06-11)
- [x] Zmienne środowiskowe, health checks, realistyczne nagłówki w silniku (✅ 2026-06-11)
- [x] Graceful error handling (błąd jednej trasy → reszta runu działa) (✅ 2026-06-11)
- [ ] Testy: unit logiki silnika; smoke happy-path end-to-end
- [ ] Rozszerzenie z podzbioru tras do pełnej mapy destynacji

---

## Zasady prowadzenia planu (postęp)

Ten dokument jest **żywy** — w trakcie realizacji aktualizujemy go na bieżąco, żeby zawsze odzwierciedlał stan faktyczny.

**Legenda statusów zadań (checkboxy w fazach):**
| Znacznik | Znaczenie |
|---|---|
| `- [ ]` | nierozpoczęte |
| `- [~] … (🚧 w toku: …)` | w trakcie (krótka notatka co dokładnie) |
| `- [x] … (✅ RRRR-MM-DD)` | ukończone + data |
| `- [!] … (⛔ blokada: …)` | zablokowane + powód |

**Status fazy** w nagłówku: `⬜ nierozpoczęta` → `🟡 w toku` → `✅ ukończona`.

**Reguły aktualizacji (stosować przy każdej sesji pracy nad kodem):**
1. **Przed** rozpoczęciem zadania oznacz je `- [~]` (w toku).
2. **Po** ukończeniu oznacz `- [x]` z datą; jeśli zmienił się zakres/sposób — dopisz jednozdaniową notkę.
3. Gdy coś blokuje — `- [!]` z powodem, zamiast cicho pomijać.
4. Zmiana decyzji projektowej → zaktualizuj **Ustalenia MVP** i/lub **Otwarte kwestie** (nie tylko checkbox).
5. Odkrycia o API/realnych trasach (np. nowy endpoint, zmiana `{ver}` Wizz) → dopisz w **Źródło danych**.
6. Na końcu sesji: zaktualizuj **Status** dotkniętych faz.

---

## Otwarte kwestie

1. **Stabilność reverse-engineered API.** Endpointy Ryanaira (Fare Finder) są stosunkowo stabilne i bez auth, ale Wizz `timetable` wymaga aktualnego `{ver}` w URL i może się zmieniać. Mitigacja: izolacja w `flights-client`, monitoring (alert gdy run zwraca 0 dealów), Kiwi jako fallback.

2. **Pokrycie tras.** Ryanair + Wizz to ~85% naszej mapy, ale część tras (np. niektóre greckie/tureckie) mogą obsługiwać inni przewoźnicy. Decyzja: MVP na 2 przewoźnikach, Kiwi/Amadeus jako rozszerzenie.

3. **Mix & match przewoźników (w MVP).** Pulujemy one-way obu przewoźników i wybieramy najtańszy wylot + najtańszy powrót niezależnie — mogą być różni (Ryanair tam / Wizz z powrotem). Konsekwencje:
   - **Booking:** przy `mixedCarrier` to **dwa osobne bilety, dwie rezerwacje** (osobne `outboundBookingUrl`/`returnBookingUrl`). UI musi to jasno komunikować („🔀 2 bilety") — brak wspólnej ochrony przy przesiadce/opóźnieniu.
   - **Bagaż:** limity i dopłaty Ryanair vs Wizz różnią się — cena „od" dotyczy lotu bez bagażu rejestrowanego (jak zwykle u LCC). Disclaimer w UI.
   - **Optymalizacja kosztów API:** dla tras obsługiwanych tylko przez jednego przewoźnika nie ma czego mieszać — można użyć round-trip / jednego źródła (mniej wywołań).

4. **`nights` vs doby.** Liczymy **noce** (różnica dni kalendarzowych dat wylotu i powrotu), nie godziny. „Czw 23:00 → niedz 18:00" = 3 noce. To stabilne dla wzorca i czytelne dla usera.

5. **Strefy czasowe.** Godziny lotów trzymamy jako **czas lokalny lotniska** (wall-clock), bo wzorzec („czwartek od 16:00") jest w czasie lokalnym wylotu. Konwersja na UTC zepsułaby filtr godzinowy. W bazie `DateTime` traktujemy jako lokalny-naiwny; frontend wyświetla bez przesunięcia.

6. **Aktualność ceny.** Cena może się zdezaktualizować między runem a kliknięciem usera. UI: znacznik „ostatnia aktualizacja", deep-link do realnej rezerwacji, disclaimer że cena orientacyjna.

7. **Auth — świadomie odłożone.** MVP bez kont; „zapisz" w `localStorage`. `AuthModule` + modele `User`/`SavedDeal` dodajemy, gdy pojawi się potrzeba synchronizacji między urządzeniami.

8. **Open-jaw (różne lotniska PL tam/z powrotem) — MVP 2.** Powrót na inne polskie lotnisko niż wylot (tam z WAW, z powrotem do KRK). Wymagania:
   - **Logika silnika:** `roundTripFares` Ryanaira zakłada to samo lotniska w obie strony, więc open-jaw trzeba budować z **dwóch zapytań one-way** (`oneWayFares`/`cheapestPerDay` osobno dla `WAW→FCO` i `FCO→KRK`) i sumować — to mnoży liczbę kombinacji (każda destynacja × każda para lotnisk PL), więc na osobny etap, nie do MVP.
   - **Schemat:** dodać `returnAirport String?` (PL lotnisko powrotu; w MVP = `originAirport`). Klucz `@@unique` rozszerzyć o `returnAirport`.
   - **UI:** osobny przełącznik filtra `openJaw` (domyślnie OFF), żeby nie zaśmiecać domyślnego widoku ofertami z dojazdem powrotnym do innego miasta.
