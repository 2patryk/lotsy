import { Injectable } from '@nestjs/common';
import { prisma } from '@lotsy/db';
import type { Prisma } from '@lotsy/db';

export interface DealsQuery {
  destCountry?: string;   // comma-separated: "IT,ES,GR"
  maxPrice?: number;
  origin?: string;        // comma-separated: "WAW,KTW"
  sort?: 'price' | 'departure' | 'duration';
  openJaw?: boolean;      // true = only open-jaw, false = only round-trips, undefined = all
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

    return prisma.deal.findMany({ where, orderBy, take: 200 });
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
