import { Injectable } from '@nestjs/common';
import { prisma } from '@lotsy/db';
import type { Prisma } from '@lotsy/db';

const MAX_RESULTS = 300;

export type CharterFlightsSort = 'price' | 'date';

export interface CharterFlightsQuery {
  oneWay: boolean;
  origin?: string[]; // departure airport IATA codes
  destCountry?: string[]; // Polish country names as returned by r.pl
  dateFrom?: string; // YYYY-MM-DD
  dateTo?: string;
  days?: number[]; // JS day numbers: 0=Sun … 6=Sat
  minPrice?: number;
  maxPrice?: number;
  sort?: CharterFlightsSort;
}

@Injectable()
export class ChartersService {
  async findFlights(query: CharterFlightsQuery) {
    const where: Prisma.CharterFlightWhereInput = {
      oneWay: query.oneWay,
      date: {
        gte: query.dateFrom
          ? new Date(`${query.dateFrom}T00:00:00Z`)
          : new Date(),
        ...(query.dateTo ? { lte: new Date(`${query.dateTo}T23:59:59Z`) } : {}),
      },
      // Round-trip rows without a paired return have no real total price.
      totalPrice: {
        not: null,
        ...(query.minPrice != null ? { gte: query.minPrice } : {}),
        ...(query.maxPrice != null ? { lte: query.maxPrice } : {}),
      },
    };
    if (query.origin?.length) where.depIata = { in: query.origin };
    if (query.destCountry?.length)
      where.destCountry = { in: query.destCountry };

    const orderBy: Prisma.CharterFlightOrderByWithRelationInput[] =
      query.sort === 'date'
        ? [{ date: 'asc' }, { totalPrice: 'asc' }]
        : [{ totalPrice: 'asc' }, { date: 'asc' }];

    const flights = await prisma.charterFlight.findMany({
      where,
      orderBy,
      // Day-of-week filtering happens in JS below, so overfetch when active.
      take: query.days?.length ? MAX_RESULTS * 4 : MAX_RESULTS,
    });

    const daySet = query.days?.length ? new Set(query.days) : null;
    const filtered = daySet
      ? flights
          .filter((f) => daySet.has(f.date.getUTCDay()))
          .slice(0, MAX_RESULTS)
      : flights;

    return filtered;
  }

  // Filter domain for the UI: departure airports, destination countries, date range.
  async getMeta() {
    const [origins, countries, dateRange, priceRange, latest] =
      await Promise.all([
        prisma.charterFlight.groupBy({
          by: ['depIata', 'depAirport'],
          orderBy: { depAirport: 'asc' },
        }),
        prisma.charterFlight.groupBy({
          by: ['destCountry'],
          orderBy: { destCountry: 'asc' },
        }),
        prisma.charterFlight.aggregate({
          _min: { date: true },
          _max: { date: true },
        }),
        prisma.charterFlight.aggregate({
          _min: { totalPrice: true },
          _max: { totalPrice: true },
        }),
        prisma.charterFlight.findFirst({
          orderBy: { updatedAt: 'desc' },
          select: { updatedAt: true },
        }),
      ]);
    return {
      origins: origins.map((o) => ({ iata: o.depIata, name: o.depAirport })),
      countries: countries.map((c) => c.destCountry),
      minDate: dateRange._min.date,
      maxDate: dateRange._max.date,
      minPrice: priceRange._min.totalPrice,
      maxPrice: priceRange._max.totalPrice,
      lastUpdate: latest?.updatedAt ?? null,
    };
  }
}
