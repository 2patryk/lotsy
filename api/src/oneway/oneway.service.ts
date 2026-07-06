import { Injectable } from '@nestjs/common';
import { prisma } from '@lotsy/db';
import type { Prisma } from '@lotsy/db';

const MAX_RESULTS = 300;

// One-way Rainbow charters (CharterFlight rows) are merged into the OUT
// results at query time — they can't live in OneWayFare because several
// charters may share (origin, destination, date), which its unique key forbids.
export interface CharterExtras {
  destCountryUrl: string;
  destNameUrl: string;
  pakietId: string | null;
  baggageKg: number | null;
}

export interface OneWayFareRow {
  id: string;
  direction: string;
  origin: string;
  originCity: string;
  originCountry: string;
  destination: string;
  destCity: string;
  destCountry: string;
  date: Date;
  departureTime: Date;
  arrivalTime: Date;
  flightNumber: string | null;
  price: number;
  currency: string;
  source: string;
  airline: string;
  updatedAt: Date;
  charter?: CharterExtras;
}

// "HH:MM" local wall-clock + the flight's UTC-midnight date → Date, matching
// the wall-clock-as-UTC convention used by OneWayFare rows.
export function timeOnDate(date: Date, hhmm: string, extraDays = 0): Date {
  const [h = 0, m = 0] = hhmm.split(':').map(Number);
  return new Date(date.getTime() + ((extraDays * 24 + h) * 60 + m) * 60_000);
}

// Diacritic- and case-insensitive normalization for label matching.
function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[łŁ]/g, 'l')
    .toLowerCase();
}

export type OneWayDirection = 'out' | 'in';
export type OneWayFaresSort = 'price' | 'date';

function toDbDirection(direction: OneWayDirection): string {
  return direction === 'in' ? 'IN' : 'OUT';
}

export interface OneWayFaresQuery {
  direction: OneWayDirection;
  plAirport?: string[]; // Polish-side IATA codes (origin when OUT, destination when IN)
  country?: string[]; // Foreign-side Polish country names (destCountry when OUT, originCountry when IN)
  city?: string[]; // Foreign-side city names; a row matches when its country OR city is selected
  airport?: string[]; // Foreign-side IATA codes, OR-ed with country/city
  dateFrom?: string; // YYYY-MM-DD
  dateTo?: string;
  days?: number[]; // JS day numbers: 0=Sun … 6=Sat
  minPrice?: number;
  maxPrice?: number;
  sort?: OneWayFaresSort;
}

@Injectable()
export class OneWayService {
  async findFares(query: OneWayFaresQuery) {
    const direction = toDbDirection(query.direction);

    const where: Prisma.OneWayFareWhereInput = {
      direction,
      date: {
        ...(query.dateFrom
          ? { gte: new Date(`${query.dateFrom}T00:00:00Z`) }
          : {}),
        ...(query.dateTo ? { lte: new Date(`${query.dateTo}T23:59:59Z`) } : {}),
      },
      price: {
        ...(query.minPrice != null ? { gte: query.minPrice } : {}),
        ...(query.maxPrice != null ? { lte: query.maxPrice } : {}),
      },
    };

    if (query.plAirport?.length) {
      if (query.direction === 'in') {
        where.destination = { in: query.plAirport };
      } else {
        where.origin = { in: query.plAirport };
      }
    }

    // Country and city selections are OR-ed: "Hiszpania" + "Praga" means
    // any Spanish airport plus Prague specifically.
    if (query.country?.length || query.city?.length || query.airport?.length) {
      const or: Prisma.OneWayFareWhereInput[] = [];
      if (query.direction === 'in') {
        if (query.country?.length)
          or.push({ originCountry: { in: query.country } });
        if (query.city?.length) or.push({ originCity: { in: query.city } });
        if (query.airport?.length) or.push({ origin: { in: query.airport } });
      } else {
        if (query.country?.length)
          or.push({ destCountry: { in: query.country } });
        if (query.city?.length) or.push({ destCity: { in: query.city } });
        if (query.airport?.length)
          or.push({ destination: { in: query.airport } });
      }
      where.OR = or;
    }

    // departureTime carries the flight's day and hour, so sorting by it alone
    // orders "by date" including the time of day.
    const orderBy: Prisma.OneWayFareOrderByWithRelationInput[] =
      query.sort === 'date'
        ? [{ departureTime: 'asc' }, { price: 'asc' }]
        : [{ price: 'asc' }, { departureTime: 'asc' }];

    const [fares, charters] = await Promise.all([
      prisma.oneWayFare.findMany({
        where,
        orderBy,
        // Day-of-week filtering happens in JS below, so overfetch when active.
        take: query.days?.length ? MAX_RESULTS * 4 : MAX_RESULTS,
      }),
      // Charters always depart Poland, so they only exist for OUT.
      query.direction === 'out'
        ? this.findCharterFares(query)
        : Promise.resolve([]),
    ]);

    const merged: OneWayFareRow[] = [
      ...(fares as OneWayFareRow[]),
      ...charters,
    ];

    const daySet = query.days?.length ? new Set(query.days) : null;
    const filtered = daySet
      ? merged.filter((f) => daySet.has(f.date.getUTCDay()))
      : merged;

    // Two sources merge in JS, so the DB orderBy alone is not enough.
    filtered.sort((a, b) =>
      query.sort === 'date'
        ? a.departureTime.getTime() - b.departureTime.getTime() ||
          a.price - b.price
        : a.price - b.price ||
          a.departureTime.getTime() - b.departureTime.getTime(),
    );

    return filtered.slice(0, MAX_RESULTS);
  }

  // One-way Rainbow charters mapped onto the OneWayFare row shape. The
  // country/city/airport OR-filter is applied in JS because the charter city
  // is a label like "Kreta - Heraklion" that needs fuzzy matching.
  private async findCharterFares(
    query: OneWayFaresQuery,
  ): Promise<OneWayFareRow[]> {
    const where: Prisma.CharterFlightWhereInput = {
      oneWay: true,
      date: {
        gte: query.dateFrom
          ? new Date(`${query.dateFrom}T00:00:00Z`)
          : new Date(),
        ...(query.dateTo ? { lte: new Date(`${query.dateTo}T23:59:59Z`) } : {}),
      },
      price: {
        ...(query.minPrice != null ? { gte: query.minPrice } : {}),
        ...(query.maxPrice != null ? { lte: query.maxPrice } : {}),
      },
      ...(query.plAirport?.length ? { depIata: { in: query.plAirport } } : {}),
    };

    const rows = await prisma.charterFlight.findMany({
      where,
      orderBy: query.sort === 'date' ? [{ date: 'asc' }] : [{ price: 'asc' }],
      take: MAX_RESULTS * 4,
    });

    const hasDestFilter =
      !!query.country?.length ||
      !!query.city?.length ||
      !!query.airport?.length;
    const countries = new Set(query.country ?? []);
    const airports = new Set(query.airport ?? []);
    const cityNeedles = (query.city ?? []).map(normalize);

    return rows
      .filter(
        (c) =>
          !hasDestFilter ||
          countries.has(c.destCountry) ||
          airports.has(c.destIata) ||
          cityNeedles.some((n) => normalize(c.destName).includes(n)),
      )
      .map((c) => {
        const departureTime = timeOnDate(c.date, c.depTime);
        // arrTime has no date of its own — an "earlier" arrival means the
        // flight lands the next day.
        const arrivalTime = timeOnDate(
          c.date,
          c.arrTime,
          c.arrTime < c.depTime ? 1 : 0,
        );
        return {
          id: c.id,
          direction: 'OUT',
          origin: c.depIata,
          originCity: c.depAirport,
          originCountry: 'Polska',
          destination: c.destIata,
          destCity: c.destName,
          destCountry: c.destCountry,
          date: c.date,
          departureTime,
          arrivalTime,
          flightNumber: c.flightNo,
          price: c.price,
          currency: 'PLN',
          source: 'RAINBOW',
          airline: c.airline,
          updatedAt: c.updatedAt,
          charter: {
            destCountryUrl: c.destCountryUrl,
            destNameUrl: c.destNameUrl,
            pakietId: c.pakietId,
            baggageKg: c.baggageKg,
          },
        };
      });
  }

  // Filter domain for the UI: Polish airports, foreign countries, date range.
  async getMeta(direction: OneWayDirection) {
    const dbDirection = toDbDirection(direction);

    const [plAirports, countries, cities, airports, dateRange, latest] =
      await Promise.all([
        direction === 'in'
          ? prisma.oneWayFare.groupBy({
              by: ['destination', 'destCity'],
              where: { direction: dbDirection },
              orderBy: { destCity: 'asc' },
            })
          : prisma.oneWayFare.groupBy({
              by: ['origin', 'originCity'],
              where: { direction: dbDirection },
              orderBy: { originCity: 'asc' },
            }),
        direction === 'in'
          ? prisma.oneWayFare.groupBy({
              by: ['originCountry'],
              where: { direction: dbDirection },
              orderBy: { originCountry: 'asc' },
            })
          : prisma.oneWayFare.groupBy({
              by: ['destCountry'],
              where: { direction: dbDirection },
              orderBy: { destCountry: 'asc' },
            }),
        direction === 'in'
          ? prisma.oneWayFare.groupBy({
              by: ['originCity', 'originCountry'],
              where: { direction: dbDirection },
              orderBy: { originCity: 'asc' },
            })
          : prisma.oneWayFare.groupBy({
              by: ['destCity', 'destCountry'],
              where: { direction: dbDirection },
              orderBy: { destCity: 'asc' },
            }),
        direction === 'in'
          ? prisma.oneWayFare.groupBy({
              by: ['origin', 'originCity', 'originCountry'],
              where: { direction: dbDirection },
              orderBy: { origin: 'asc' },
            })
          : prisma.oneWayFare.groupBy({
              by: ['destination', 'destCity', 'destCountry'],
              where: { direction: dbDirection },
              orderBy: { destination: 'asc' },
            }),
        prisma.oneWayFare.aggregate({
          where: { direction: dbDirection },
          _min: { date: true },
          _max: { date: true },
        }),
        prisma.oneWayFare.findFirst({
          where: { direction: dbDirection },
          orderBy: { updatedAt: 'desc' },
          select: { updatedAt: true },
        }),
      ]);

    const plAirportList =
      direction === 'in'
        ? (plAirports as { destination: string; destCity: string }[]).map(
            (a) => ({
              iata: a.destination,
              city: a.destCity,
            }),
          )
        : (plAirports as { origin: string; originCity: string }[]).map((a) => ({
            iata: a.origin,
            city: a.originCity,
          }));

    const countryList =
      direction === 'in'
        ? (countries as { originCountry: string }[]).map((c) => c.originCountry)
        : (countries as { destCountry: string }[]).map((c) => c.destCountry);

    const cityList =
      direction === 'in'
        ? (cities as { originCity: string; originCountry: string }[]).map(
            (c) => ({ name: c.originCity, country: c.originCountry }),
          )
        : (cities as { destCity: string; destCountry: string }[]).map((c) => ({
            name: c.destCity,
            country: c.destCountry,
          }));

    const airportList =
      direction === 'in'
        ? (
            airports as {
              origin: string;
              originCity: string;
              originCountry: string;
            }[]
          ).map((a) => ({
            iata: a.origin,
            city: a.originCity,
            country: a.originCountry,
          }))
        : (
            airports as {
              destination: string;
              destCity: string;
              destCountry: string;
            }[]
          ).map((a) => ({
            iata: a.destination,
            city: a.destCity,
            country: a.destCountry,
          }));

    const meta = {
      plAirports: plAirportList,
      countries: countryList,
      cities: cityList,
      airports: airportList,
      dateMin: dateRange._min.date,
      dateMax: dateRange._max.date,
      lastUpdated: latest?.updatedAt ?? null,
    };

    // OUT results also include one-way charters — extend the filter domains
    // with their airports/countries so charter-only destinations are pickable.
    if (direction === 'out') {
      const charterWhere = { oneWay: true, date: { gte: new Date() } };
      const [chDeps, chDests, chDates] = await Promise.all([
        prisma.charterFlight.groupBy({
          by: ['depIata', 'depAirport'],
          where: charterWhere,
        }),
        prisma.charterFlight.groupBy({
          by: ['destIata', 'destName', 'destCountry'],
          where: charterWhere,
        }),
        prisma.charterFlight.aggregate({
          where: charterWhere,
          _min: { date: true },
          _max: { date: true },
        }),
      ]);

      const plSeen = new Set(meta.plAirports.map((a) => a.iata));
      for (const d of chDeps) {
        if (plSeen.has(d.depIata)) continue;
        plSeen.add(d.depIata);
        meta.plAirports.push({ iata: d.depIata, city: d.depAirport });
      }
      meta.plAirports.sort((a, b) => a.city.localeCompare(b.city, 'pl'));

      const countrySeen = new Set(meta.countries);
      const citySeen = new Set(meta.cities.map((c) => c.name));
      const airportSeen = new Set(meta.airports.map((a) => a.iata));
      for (const d of chDests) {
        if (!countrySeen.has(d.destCountry)) {
          countrySeen.add(d.destCountry);
          meta.countries.push(d.destCountry);
        }
        if (!citySeen.has(d.destName)) {
          citySeen.add(d.destName);
          meta.cities.push({ name: d.destName, country: d.destCountry });
        }
        if (!airportSeen.has(d.destIata)) {
          airportSeen.add(d.destIata);
          meta.airports.push({
            iata: d.destIata,
            city: d.destName,
            country: d.destCountry,
          });
        }
      }
      meta.countries.sort((a, b) => a.localeCompare(b, 'pl'));
      meta.cities.sort((a, b) => a.name.localeCompare(b.name, 'pl'));
      meta.airports.sort((a, b) => a.iata.localeCompare(b.iata));

      if (
        chDates._min.date &&
        (!meta.dateMin || chDates._min.date < meta.dateMin)
      ) {
        meta.dateMin = chDates._min.date;
      }
      if (
        chDates._max.date &&
        (!meta.dateMax || chDates._max.date > meta.dateMax)
      ) {
        meta.dateMax = chDates._max.date;
      }
    }

    return meta;
  }
}
