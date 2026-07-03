import { prisma } from '@lotsy/db';

// Rainbow (r.pl) charter overview API — public, no cookies/session required.
// One call returns ALL destinations with the lowest price per person;
// oneWay=false → cheapest round-trip, oneWay=true → cheapest one-way.
const API_URL = 'https://r.pl/api/czartery/wyszukiwanie/v4.1/wyszukaj';

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36';

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

// Prices are per person and depend on passenger birth dates; use 1 adult (~30y),
// consistent with the rest of lotsy (fixed 1 passenger).
function adultBirthDate(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 30);
  return d.toISOString().slice(0, 10);
}

async function fetchDestinations(oneWay: boolean): Promise<RainbowDestination[]> {
  const params = new URLSearchParams({
    oneWay: String(oneWay),
    dataUrodzenia: adultBirthDate(),
    sortowanie: 'cena',
  });
  const res = await fetch(`${API_URL}?${params}`, {
    headers: { accept: 'application/json', 'user-agent': USER_AGENT, 'x-source': 'r.pl' },
  });
  if (!res.ok) throw new Error(`r.pl API ${res.status} (oneWay=${oneWay})`);
  const data = (await res.json()) as RainbowSearchResponse;
  if (!Array.isArray(data.Destynacje)) throw new Error(`r.pl API: unexpected response shape`);
  return data.Destynacje;
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
    const cheapest = [...offers]
      .filter((o) => o.priceRoundTrip != null)
      .sort((a, b) => a.priceRoundTrip! - b.priceRoundTrip!)
      .slice(0, 10);
    for (const o of cheapest) {
      console.log(
        `  ${o.destIata} ${o.destName} (${o.destCountry}): RT ${o.priceRoundTrip} zł, OW ${o.priceOneWay ?? '—'} zł`,
      );
    }
    return;
  }

  // Latest snapshot only: replace table contents atomically so destinations
  // that disappeared from r.pl don't linger.
  await prisma.$transaction([
    prisma.charterOffer.deleteMany(),
    prisma.charterOffer.createMany({ data: offers }),
  ]);
  console.log(`[charters] saved ${offers.length} offers`);
}

main()
  .catch((err) => {
    console.error('[charters] FAILED:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
