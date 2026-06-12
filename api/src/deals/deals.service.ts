import { Injectable } from '@nestjs/common';
import { prisma } from '@lotsy/db';
import type { Prisma } from '@lotsy/db';

const METRO_GROUPS: string[][] = [
  ['WAW', 'WMI'], // Warsaw Chopin + Modlin
  ['KRK', 'KTW'], // Kraków + Katowice
];

function dealLevel(origin: string, ret: string): 1 | 2 | 3 {
  if (origin === ret) return 1;
  if (METRO_GROUPS.some((g) => g.includes(origin) && g.includes(ret))) return 2;
  return 3;
}

export interface DealsQuery {
  destCountry?: string; // comma-separated: "IT,ES,GR"
  maxPrice?: number;
  origin?: string; // comma-separated: "WAW,KTW"
  sort?: 'price' | 'departure' | 'duration';
  levels?: number[]; // [1,2,3] = all; [1] = round-trip; [2] = nearby; [3] = open-jaw
  minNights?: number;
  maxNights?: number;
  perCountry?: number;
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
      const countries = query.destCountry
        .split(',')
        .map((c) => c.trim().toUpperCase());
      where.destCountry = { in: countries };
    }

    if (query.maxPrice) {
      where.totalPrice = { lte: Number(query.maxPrice) };
    }

    if (query.origin) {
      const origins = query.origin
        .split(',')
        .map((o) => o.trim().toUpperCase());
      where.originAirport = { in: origins };
    }

    if (query.minNights != null || query.maxNights != null) {
      where.nights = {
        ...(query.minNights != null ? { gte: query.minNights } : {}),
        ...(query.maxNights != null ? { lte: query.maxNights } : {}),
      };
    }

    // Optimize at DB level when all requested levels are on the same side of openJaw
    const levels = query.levels ?? [1, 2, 3];
    const wantsRoundTrip = levels.includes(1);
    const wantsOpenJaw = levels.includes(2) || levels.includes(3);
    if (wantsRoundTrip && !wantsOpenJaw) where.openJaw = false;
    if (wantsOpenJaw && !wantsRoundTrip) where.openJaw = true;

    const orderBy: Prisma.DealOrderByWithRelationInput =
      query.sort === 'departure'
        ? { departAt: 'asc' }
        : query.sort === 'duration'
          ? { nights: 'asc' }
          : { totalPrice: 'asc' };

    const levelSet = new Set(levels);

    const applyLevelFilter = <
      T extends { originAirport: string; returnAirport: string },
    >(
      deals: T[],
    ) => {
      if (levelSet.size === 3) return deals; // all levels — skip filtering
      return deals.filter((d) =>
        levelSet.has(dealLevel(d.originAirport, d.returnAirport)),
      );
    };

    if (query.destCountry) {
      const all = await prisma.deal.findMany({ where, orderBy, take: 200 });
      return applyLevelFilter(all);
    }

    const perCountry = query.perCountry ?? 30;
    const all = await prisma.deal.findMany({ where, orderBy });
    const leveled = applyLevelFilter(all);

    const countsByCountry = new Map<string, number>();
    const result: typeof leveled = [];
    for (const deal of leveled) {
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
