import { Injectable } from '@nestjs/common';
import { prisma } from '@lotsy/db';

export type CharterSort = 'roundTrip' | 'oneWay';

export interface ChartersQuery {
  sort?: CharterSort;
  country?: string;
}

@Injectable()
export class ChartersService {
  async findAll(query: ChartersQuery) {
    const sort: CharterSort = query.sort ?? 'roundTrip';
    const priceField = sort === 'oneWay' ? 'priceOneWay' : 'priceRoundTrip';

    const offers = await prisma.charterOffer.findMany({
      where: {
        [priceField]: { not: null },
        ...(query.country
          ? { destCountry: { equals: query.country, mode: 'insensitive' } }
          : {}),
      },
      orderBy: [{ [priceField]: 'asc' }, { destName: 'asc' }],
    });
    return offers;
  }

  async getLastUpdate() {
    const latest = await prisma.charterOffer.findFirst({
      orderBy: { updatedAt: 'desc' },
      select: { updatedAt: true },
    });
    return latest?.updatedAt ?? null;
  }
}
