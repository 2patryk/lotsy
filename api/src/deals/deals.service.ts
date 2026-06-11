import { Injectable } from '@nestjs/common';
import { prisma } from '@lotsy/db';
import type { Prisma } from '@lotsy/db';

export interface DealsQuery {
  destCountry?: string;   // comma-separated: "IT,ES,GR"
  maxPrice?: number;
  origin?: string;        // comma-separated: "WAW,KTW"
  sort?: 'price' | 'departure' | 'duration';
  openJaw?: boolean;      // true = only open-jaw, false = only round-trips, undefined = all
  perCountry?: number;    // max results per destination country (used when no destCountry filter)
}

@Injectable()
export class DealsService {
  async findAll(query: DealsQuery) {
    const now = new Date();

    const where: Prisma.DealWhereInput = {
      expiresAt: { gt: now },
      departAt: { gt: now },
    };

    if (query.destCountry) {
      const countries = query.destCountry.split(',').map((c) => c.trim().toUpperCase());
      where.destCountry = { in: countries };
    }

    if (query.maxPrice) {
      where.totalPrice = { lte: Number(query.maxPrice) };
    }

    if (query.origin) {
      const origins = query.origin.split(',').map((o) => o.trim().toUpperCase());
      where.originAirport = { in: origins };
    }

    if (query.openJaw === true) {
      where.openJaw = true;
    } else if (query.openJaw === false) {
      where.openJaw = false;
    }

    const orderBy: Prisma.DealOrderByWithRelationInput =
      query.sort === 'departure'
        ? { departAt: 'asc' }
        : query.sort === 'duration'
          ? { nights: 'asc' }
          : { totalPrice: 'asc' };

    // When filtering by specific country/countries, return up to 200 per query.
    // When no country filter, cap per-country to avoid UK/GB dominating the list.
    if (query.destCountry) {
      return prisma.deal.findMany({ where, orderBy, take: 200 });
    }

    const perCountry = query.perCountry ?? 30;
    const all = await prisma.deal.findMany({ where, orderBy });

    const countsByCountry = new Map<string, number>();
    const result = [];
    for (const deal of all) {
      const count = countsByCountry.get(deal.destCountry) ?? 0;
      if (count < perCountry) {
        result.push(deal);
        countsByCountry.set(deal.destCountry, count + 1);
      }
    }
    return result;
  }

  async findOne(id: string) {
    return prisma.deal.findUnique({ where: { id } });
  }

  async getLastSuccessfulRun() {
    return prisma.searchRun.findFirst({
      where: { status: 'SUCCESS' },
      orderBy: { startedAt: 'desc' },
    });
  }
}
