# Wizz Air — research: bezpośrednie podpięcie pod loty one-way

> Cel: pobierać ceny/rozkłady Wizz Air **bezpośrednio z ich własnego backendu** (`be.wizzair.com`),
> bez pośredników (Amadeus, Kiwi, RapidAPI, Parse.bot, scraperów SaaS).
> Data researchu: 2026-07-05.

---

## TL;DR (wnioski)

1. **Da się bezpośrednio.** Wizz Air ma nieoficjalny, ale publiczny backend `be.wizzair.com`
   z tym samym API, którego używa ich strona. To jego pytamy — zero pośredników.
2. **Dwa kluczowe endpointy:**
   - `Api/asset/map` — pełna mapa tras (miasta + `connections`) → discovery realnych połączeń, cache 1×/dobę.
   - `Api/search/timetable` — najtańsza cena one-way per dzień w oknie **do 42 dni** (POST, JSON).
     To dokładny odpowiednik naszego Ryanair `getCheapestPerDay` → wchodzi 1:1 w model **mix & match**.
3. **Blokada 403 (CloudFront) z PLAN.md wynika z dwóch rzeczy** i obie da się rozwiązać:
   - **złych nagłówków** — trzeba wysłać `Origin: https://wizzair.com`, `Referer: https://wizzair.com/...`
     oraz realistyczny `User-Agent`. Bez tego CloudFront odrzuca jako bota.
   - **nieaktualnej wersji w ścieżce** — `{ver}` (np. `10.1.0`) zmienia się przy każdym deployu.
     Zahardkodowana wersja z czasem zwraca błąd. Trzeba ją **pobierać dynamicznie** (patrz niżej).
4. **Rekomendacja:** dopisać `packages/flights-client/src/wizzair.ts` symetryczny do `ryanair.ts`
   (`getWizzTimetable`, `getWizzRoutes`), z auto-detekcją wersji i cache tras. Reszta pipeline'u
   (mix & match, `outboundSource='WIZZAIR'`) jest już przewidziana w PLAN.md.

---

## Endpointy (bezpośrednie, `be.wizzair.com`)

### 1. Mapa tras — discovery połączeń
```
GET https://be.wizzair.com/{ver}/Api/asset/map?languageCode=pl-pl
```
Zwraca `cities[]`, każde miasto ma: `iata`, `shortName`, `countryCode`, `latitude`, `longitude`,
`currencyCode` oraz **`connections[]`** (lista tras z tego lotniska). To odpowiednik Ryanair
`routes/destinations` — pozwala odfiltrować realnie latane pary i **nie marnować zapytań**
na nieistniejące połączenia. Cache raz na dobę (identycznie jak w route-cache dla Ryanair).

### 2. Timetable — najtańsza cena one-way per dzień
```
POST https://be.wizzair.com/{ver}/Api/search/timetable
Content-Type: application/json;charset=UTF-8
```
Body:
```jsonc
{
  "flightList": [
    { "departureStation": "WAW", "arrivalStation": "CTA", "from": "2026-08-01", "to": "2026-09-11" },
    { "departureStation": "CTA", "arrivalStation": "WAW", "from": "2026-08-01", "to": "2026-09-11" }
  ],
  "priceType": "regular",   // "regular" = cena bez WDC; "wdc" = cena z kartą zniżkową
  "adultCount": 1,
  "childCount": 0,
  "infantCount": 0
}
```
- Zwraca **najtańszą cenę per dzień** dla obu kierunków w jednym wywołaniu → idealne pod mix & match
  (outbound i return niezależnie, poolowane z Ryanairem).
- **Limit okna: 42 dni** na jedno zapytanie. Dłuższy zakres → pętla po oknach
  (np. 6 × 42 dni ≈ 250 dni horyzontu).
- Duża przewaga nad Ryanairem: **oba kierunki + od razu godziny lotów** w jednym POST-cie.

### Nagłówki (WYMAGANE — inaczej 403)
```
authority:     be.wizzair.com
origin:        https://wizzair.com
referer:       https://wizzair.com/pl-pl/flights/timetable
user-agent:    Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/... Safari/537.36
accept:        application/json, text/plain, */*
content-type:  application/json;charset=UTF-8
accept-language: pl-PL,pl;q=0.9,en;q=0.8
sec-fetch-site: same-site
sec-fetch-mode: cors
```

---

## Problem `{ver}` — auto-detekcja wersji

Wersja w ścieżce (`10.1.0`, `10.x.y`...) zmienia się przy deployach Wizza. Zahardkodowanie =
API padnie za kilka tygodni. Strategia (od najprostszej):

1. **Parsowanie z frontu:** `GET https://wizzair.com/` (lub bundla JS) i wyłuskanie aktualnego
   `apiVersion` / ścieżki `be.wizzair.com/<ver>/`. Cache wyniku (np. 6–24 h).
2. **Fallback po błędzie:** przy odpowiedzi wskazującej złą wersję (400/404/426) — odśwież wersję
   z kroku 1 i powtórz zapytanie raz (retry-on-stale-version).
3. Trzymać ostatnią znaną dobrą wersję w cache/ENV jako seed.

> Do zaimplementowania: mały helper `getWizzApiVersion()` z cache w pamięci + refetch na błędzie.

---

## Blokada 403 — plan awaryjny

Jeśli po ustawieniu poprawnych nagłówków + świeżej wersji **nadal 403** (CloudFront może blokować
po IP/reputacji, zwłaszcza z chmury/Render):
1. **Najpierw**: sprawdzić z lokalnego IP z pełnym zestawem nagłówków — zwykle to wystarcza.
2. Jeśli blokada jest IP-owa z serwera: rozważyć proxy o dobrej reputacji / residential, albo
   pobrać jednorazowo cookie przez realną przeglądarkę (mamy Claude-in-Chrome) i podać w żądaniach.
3. Ostateczność (odrzucona wcześniej, ale do zapamiętania): oficjalny Wizz Air Direct / Amadeus —
   ale to **łamie wymóg „bez pośredników"**, więc tylko gdyby backend całkiem się zamknął.

---

## Plan implementacji

### Faza W1 — klient Wizz (pojedyncza trasa) ✅ ZROBIONE (2026-07-05, zweryfikowane na żywo)
- [x] `packages/flights-client/src/wizzair.ts`:
  - [x] `getWizzApiVersion()` — auto-detekcja z `wizzair.com` + cache. **Wykryła 29.5.0** (seed `10.1.0` był nieaktualny → potwierdza, że dynamiczna detekcja jest konieczna).
  - [x] `getWizzTimetable({origin, dest, from, to, priceType})` → `DailyFare[]` (`source: 'WIZZAIR'`), pętla po oknach 42-dniowych.
  - [x] `getWizzRoutes(origin)` → `string[]` z `Api/asset/map`.
- [x] `http.ts`: dodane `fetchJsonPost` + `fetchText`; retry-on-stale-version w `wizzair.ts` (`withVersion`).
- [x] Typy w `types.ts`: `WizzTimetableResponse`, `WizzMapResponse`, `WizzTimetableParams`.
- [x] Smoke-test: **działa bez 403** — WAW: 77 tras, KTW→BCN i WAW→CTA zwracają realne ceny.

> **Wniosek z testu:** blokada 403 z PLAN.md rozwiązana wyłącznie nagłówkami (`Origin`/`Referer`)
> + dynamiczną wersją. Nie było potrzeby proxy ani cookie z przeglądarki. Plan awaryjny zostaje na wypadek blokad IP z serwera prod (Render).

### Faza W2 — integracja z silnikiem (mix & match) ✅ ZROBIONE (2026-07-05, dry-run zweryfikowany)
- [x] `engine/src/oneway.ts`: Wizz jako drugie źródło. `mergeWizzRoutes()` pobiera mapę tras Wizza
      (`getWizzRoutes` per PL lotnisko), oznacza wspólne trasy i dokłada trasy Wizz-only (OUT+IN).
- [x] Pooling one-way per (trasa, dzień): `fetchDetails` zbiera taryfy Ryanair + Wizz do jednej mapy
      i zostawia **najtańszą** — `source`/`airline` zapisują zwycięskiego przewoźnika.
- [x] Schema `OneWayFare`: dodane `source` + `airline` (migracja `20260705120000_add_oneway_source`, zaaplikowana na Neon).
- [x] API (`oneway.service`) zwraca pełny wiersz → `source`/`airline` przechodzą do frontu bez zmian.
- [x] Frontend `/jedna-strona`: chip przewoźnika dynamiczny (`f.airline`, różowy `chip-wizz`),
      `bookingUrl` kieruje do wizzair.com dla lotów Wizza.
- **Wynik dry-run:** 818 tras (399 OUT / 419 IN), 3826 wierszy, **357 dni gdzie Wizz jest tańszy**.

> **Uwaga (znane ograniczenie):** dla lotnisk zagranicznych, które lata **tylko** Wizz (nie ma ich
> w discovery Ryanaira), brakuje polskich nazw miasta/kraju → front pokaże kod IATA. Overlap z
> Ryanairem pokrywa większość tras płd. Europy. Wzbogacenie nazw = ewentualna Faza W4.

### Faza W3 — hardening ✅ ZROBIONE (2026-07-05)
- [x] Throttling Wizza osobno od Ryanaira: `WIZZ_MAX_CONCURRENT=2`, `WIZZ_BATCH_DELAY_MS=600`.
- [x] Retry na 5xx (Wizz zwraca **HTTP 503 pod obciążeniem**) + 429/403; backoff wykładniczy z jitterem,
      `MAX_RETRIES=4` (pierwszy dry-run: 200 błędów 503 → naprawione przez retry-on-5xx).
- [x] Degradacja zamiast crasha: jeśli **całe** route-discovery Wizza padnie → `wizzEnabled=false`,
      run leci na samym Ryanairze. Pojedyncze błędy tras są izolowane (`Promise.allSettled`) i tylko logowane.
- [x] Kill-switch: `ENABLE_WIZZ=false` wyłącza Wizza globalnie (np. gdyby prod IP dostał bana).
- [x] Weryfikacja: dry-run na pełnej siatce + smoke-test klienta vs realne ceny wizzair.com.

---

### Faza W4 — poprawki po wdrożeniu (2026-07-05)
- [x] **Waluta → PLN:** Wizz zwraca ceny w walucie kraju **wylotu** (EUR/GBP/HUF/RON…), więc
      pooling porównywał surowe EUR z PLN Ryanaira i wybierał źle. `engine/src/fx.ts` pobiera kursy
      ECB (Frankfurter, darmowe, bez klucza) i normalizuje **każdą** taryfę do PLN **przed** poolingiem
      i zapisem. Waluty spoza ECB (ILS, MAD, TND, AED, JOD — Izrael/Maroko/Tunezja/Jordania) są
      **dropowane** (~37/run) zamiast psuć porównanie; te trasy pokrywa Ryanair.
- [x] **Deep-link Wizz (poprawny format, zweryfikowany w przeglądarce):**
      `https://wizzair.com/pl-pl/booking/select-flight/{dep}/{arr}/{data}/null/1/0/0/null`
      (ścieżkowy, prefilluje lot). Forma z query-params otwierała tylko stronę bez wyboru lotu.
- [x] **Neon drop połączenia (57P01):** darmowy tier usypia compute w trakcie ~10-min fazy pobierania.
      Fix: rekord runu tworzony dopiero tuż przed zapisem (brak idle) + `withDbRetry` (reconnect).

## Źródła
- [wizzair-scraper (timetable, payload + nagłówki)](https://github.com/kovacskokokornel/wizzair-scraper/blob/master/wizzair_timetable.py)
- [projectivemotion/wizzair-scraper (przykładowy output, wersje API)](https://github.com/projectivemotion/wizzair-scraper)
- [Issue: Current API version](https://github.com/projectivemotion/wizzair-scraper/issues/10)
- [Opis endpointu asset/map — cities + connections](https://parse.bot/marketplace/11c44931-5d3f-4a6e-9ecb-ec67d9d42137/wizzair-com-api)
