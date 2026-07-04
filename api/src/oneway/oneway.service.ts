import { Injectable } from '@nestjs/common';
import { prisma } from '@lotsy/db';
import type { Prisma } from '@lotsy/db';

const MAX_RESULTS = 300;

export type OneWayDirection = 'out' | 'in';
export type OneWayFaresSort = 'price' | 'date';

function toDbDirection(direction: OneWayDirection): string {
  return direction === 'in' ? 'IN' : 'OUT';
}

export interface OneWayFaresQuery {
  direction: OneWayDirection;
  plAirport?: string[]; // Polish-side IATA codes (origin when OUT, destination when IN)
  country?: string[]; // Foreign-side Polish country names (destCountry when OUT, originCountry when IN)
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

    if (query.country?.length) {
      if (query.direction === 'in') {
        where.originCountry = { in: query.country };
      } else {
        where.destCountry = { in: query.country };
      }
    }

    const orderBy: Prisma.OneWayFareOrderByWithRelationInput[] =
      query.sort === 'date'
        ? [{ date: 'asc' }, { price: 'asc' }]
        : [{ price: 'asc' }, { date: 'asc' }];

    const fares = await prisma.oneWayFare.findMany({
      where,
      orderBy,
      // Day-of-week filtering happens in JS below, so overfetch when active.
      take: query.days?.length ? MAX_RESULTS * 4 : MAX_RESULTS,
    });

    const daySet = query.days?.length ? new Set(query.days) : null;
    const filtered = daySet
      ? fares
          .filter((f) => daySet.has(f.date.getUTCDay()))
          .slice(0, MAX_RESULTS)
      : fares;

    return filtered;
  }

  // Filter domain for the UI: Polish airports, foreign countries, date range.
  async getMeta(direction: OneWayDirection) {
    const dbDirection = toDbDirection(direction);

    const [plAirports, countries, dateRange, latest] = await Promise.all([
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

    return {
      plAirports: plAirportList,
      countries: countryList,
      dateMin: dateRange._min.date,
      dateMax: dateRange._max.date,
      lastUpdated: latest?.updatedAt ?? null,
    };
  }
}
