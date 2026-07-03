import { prisma, type Prisma } from '@lotsy/db';

// Rainbow (r.pl) charter APIs — public, no cookies/session required.
// Overview: one call returns ALL destinations with the lowest price per person
// (oneWay=false → cheapest round-trip, oneWay=true → cheapest one-way).
// Detail: wyszukaj-wylot accepts an arbitrarily wide date range, so one call
// per destination per mode returns every concrete flight (date, departure
// airport, times, airline, flight number, price, package id).
const OVERVIEW_URL = 'https://r.pl/api/czartery/wyszukiwanie/v4.1/wyszukaj';
const FLIGHTS_URL = 'https://r.pl/api/czartery/destynacja/v4.1/wyszukaj-wylot';

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36';

const MAX_CONCURRENT = 3;
const BATCH_DELAY_MS = 300;
const HORIZON_MONTHS = 12;
const INSERT_CHUNK = 1000;

const DRY_RUN = process.argv.includes('--dry-run');

interface RainbowDestination {
  Panstwo: string;
  PanstwoUrl: string;
  Nazwa: string;
  NazwaUrl: string;
  Klucz: string;
  TerminWyjazdu: string | null;
  Zdjecie410x225: string | null;
  Bagaz: number | null;
  Cena: number | null;
}

interface RainbowSearchResponse {
  Destynacje: RainbowDestination[];
}

interface RainbowTicket {
  Wylot: { Przystanek: string; Iata: string; Godzina: string };
  Przylot: { Przystanek: string; Iata: string; Godzina: string };
  NazwaPrzewoznika: string;
  NumerLotu: string | null;
  CzasLotu: string | null;
  BagazRejestrowany: number | null;
  Cena: number;
  Pakiety: string[] | null;
}

interface RainbowFlightDay {
  Data: string;
  Cena: number;
  Bilety: RainbowTicket[];
}

type CharterFlightRow = Prisma.CharterFlightCreateManyInput;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// Prices are per person and depend on passenger birth dates; use 1 adult (~30y),
// consistent with the rest of lotsy (fixed 1 passenger).
function adultBirthDate(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 30);
  return d.toISOString().slice(0, 10);
}

async function rainbowGet<T>(url: string, params: URLSearchParams): Promise<T> {
  const res = await fetch(`${url}?${params}`, {
    headers: { accept: 'application/json', 'user-agent': USER_AGENT, 'x-source': 'r.pl' },
  });
  if (!res.ok) throw new Error(`r.pl API ${res.status} (${url.split('/').pop()}?${params})`);
  return (await res.json()) as T;
}

async function fetchDestinations(oneWay: boolean): Promise<RainbowDestination[]> {
  const data = await rainbowGet<RainbowSearchResponse>(
    OVERVIEW_URL,
    new URLSearchParams({
      oneWay: String(oneWay),
      dataUrodzenia: adultBirthDate(),
      sortowanie: 'cena',
    }),
  );
  if (!Array.isArray(data.Destynacje)) throw new Error(`r.pl API: unexpected response shape`);
  return data.Destynacje;
}

// All concrete flights to a destination across the whole horizon, one mode.
async function fetchFlights(
  dest: RainbowDestination,
  oneWay: boolean,
): Promise<CharterFlightRow[]> {
  const today = new Date();
  const max = new Date(today);
  max.setMonth(max.getMonth() + HORIZON_MONTHS);
  const days = await rainbowGet<RainbowFlightDay[]>(
    FLIGHTS_URL,
    new URLSearchParams({
      iataDokad: dest.Klucz,
      dataMin: today.toISOString().slice(0, 10),
      dataMax: max.toISOString().slice(0, 10),
      oneWay: String(oneWay),
      dataUrodzenia: adultBirthDate(),
    }),
  );
  if (!Array.isArray(days)) return [];

  const rows: CharterFlightRow[] = [];
  for (const day of days) {
    for (const t of day.Bilety ?? []) {
      if (t.Cena == null) continue;
      rows.push({
        oneWay,
        destIata: dest.Klucz,
        destName: dest.Nazwa,
        destNameUrl: dest.NazwaUrl,
        destCountry: dest.Panstwo,
        destCountryUrl: dest.PanstwoUrl,
        imageUrl: dest.Zdjecie410x225,
        date: new Date(`${day.Data.slice(0, 10)}T00:00:00Z`),
        depTime: t.Wylot.Godzina,
        arrTime: t.Przylot.Godzina,
        depIata: t.Wylot.Iata,
        depAirport: t.Wylot.Przystanek,
        airline: t.NazwaPrzewoznika,
        flightNo: t.NumerLotu,
        flightTime: t.CzasLotu,
        baggageKg: t.BagazRejestrowany,
        price: t.Cena,
        pakietId: t.Pakiety?.[0] ?? null,
      });
    }
  }
  return rows;
}

interface MergedOffer {
  destIata: string;
  destName: string;
  destNameUrl: string;
  destCountry: string;
  destCountryUrl: string;
  priceRoundTrip: number | null;
  priceOneWay: number | null;
  nearestDeparture: Date | null;
  baggageKg: number | null;
  imageUrl: string | null;
}

function merge(roundTrip: RainbowDestination[], oneWay: RainbowDestination[]): MergedOffer[] {
  const byIata = new Map<string, MergedOffer>();
  const upsert = (d: RainbowDestination): MergedOffer => {
    let offer = byIata.get(d.Klucz);
    if (!offer) {
      offer = {
        destIata: d.Klucz,
        destName: d.Nazwa,
        destNameUrl: d.NazwaUrl,
        destCountry: d.Panstwo,
        destCountryUrl: d.PanstwoUrl,
        priceRoundTrip: null,
        priceOneWay: null,
        nearestDeparture: d.TerminWyjazdu ? new Date(d.TerminWyjazdu) : null,
        baggageKg: d.Bagaz,
        imageUrl: d.Zdjecie410x225,
      };
      byIata.set(d.Klucz, offer);
    }
    return offer;
  };
  for (const d of roundTrip) upsert(d).priceRoundTrip = d.Cena;
  for (const d of oneWay) upsert(d).priceOneWay = d.Cena;
  return [...byIata.values()];
}

// Fetch every flight for every destination × mode; failures skip the batch so a
// single destination can't sink the whole run.
async function fetchAllFlights(
  roundTrip: RainbowDestination[],
  oneWay: RainbowDestination[],
): Promise<CharterFlightRow[]> {
  const jobs: Array<{ dest: RainbowDestination; oneWay: boolean }> = [
    ...roundTrip.filter((d) => d.Cena != null).map((dest) => ({ dest, oneWay: false })),
    ...oneWay.filter((d) => d.Cena != null).map((dest) => ({ dest, oneWay: true })),
  ];

  const rows: CharterFlightRow[] = [];
  let failures = 0;
  for (let i = 0; i < jobs.length; i += MAX_CONCURRENT) {
    const batch = jobs.slice(i, i + MAX_CONCURRENT);
    await Promise.all(
      batch.map(async ({ dest, oneWay: ow }) => {
        try {
          rows.push(...(await fetchFlights(dest, ow)));
        } catch (err) {
          failures++;
          console.warn(`[charters] flights failed for ${dest.Klucz} (oneWay=${ow}): ${err}`);
        }
      }),
    );
    if (i + MAX_CONCURRENT < jobs.length) await sleep(BATCH_DELAY_MS);
  }
  console.log(
    `[charters] flights: ${jobs.length} lookups, ${rows.length} rows, ${failures} failures`,
  );
  return rows;
}

async function main() {
  console.log(`[charters] fetching r.pl overview (dry-run: ${DRY_RUN})`);
  const [roundTrip, oneWay] = await Promise.all([
    fetchDestinations(false),
    fetchDestinations(true),
  ]);
  const offers = merge(roundTrip, oneWay);
  console.log(
    `[charters] round-trip: ${roundTrip.length}, one-way: ${oneWay.length}, merged: ${offers.length}`,
  );

  if (DRY_RUN) {
    // Sample a few destinations end-to-end without writing to the DB.
    const sample = roundTrip.filter((d) => d.Cena != null).slice(0, 2);
    const rows = await fetchAllFlights(sample, []);
    const cheapest = [...rows].sort((a, b) => a.price - b.price).slice(0, 5);
    for (const f of cheapest) {
      console.log(
        `  ${(f.date as Date).toISOString().slice(0, 10)} ${f.depTime} ${f.depAirport} (${f.depIata}) → ${f.destName} (${f.destIata}) przylot ${f.arrTime} | ${f.airline} ${f.flightNo ?? ''} | ${f.price} zł | pakiet ${f.pakietId}`,
      );
    }
    return;
  }

  const flights = await fetchAllFlights(roundTrip, oneWay);

  // Latest snapshot only: replace table contents atomically so flights that
  // disappeared from r.pl don't linger. createMany is chunked to stay under
  // Postgres parameter limits.
  await prisma.$transaction([
    prisma.charterOffer.deleteMany(),
    prisma.charterOffer.createMany({ data: offers }),
    prisma.charterFlight.deleteMany(),
    ...Array.from({ length: Math.ceil(flights.length / INSERT_CHUNK) }, (_, i) =>
      prisma.charterFlight.createMany({
        data: flights.slice(i * INSERT_CHUNK, (i + 1) * INSERT_CHUNK),
      }),
    ),
  ]);
  console.log(`[charters] saved ${offers.length} offers, ${flights.length} flights`);
}

main()
  .catch((err) => {
    console.error('[charters] FAILED:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
