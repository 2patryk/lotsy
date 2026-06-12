import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { prisma } from '@lotsy/db';

const POLISH_IATAS = ['WAW', 'WMI', 'KTW', 'KRK', 'GDN', 'WRO', 'POZ', 'LCJ'];
const AIRPORTS_URL =
  'https://www.ryanair.com/api/views/locate/3/airports/pl/active';
const ROUTES_URL = (iata: string) =>
  `https://www.ryanair.com/api/views/locate/searchWidget/routes/pl/airport/${iata}`;
const SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000;

interface RyanairAirport {
  code: string;
  city: { name: string };
  country: { code: string };
}

interface RyanairRoute {
  arrivalAirport: { code: string };
}

@Injectable()
export class AirportsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AirportsService.name);

  async onApplicationBootstrap() {
    const sync = await prisma.airportSync.findUnique({ where: { id: 'main' } });
    const stale =
      !sync || Date.now() - sync.syncedAt.getTime() > SYNC_INTERVAL_MS;
    if (stale) void this.sync();
    setInterval(() => void this.sync(), SYNC_INTERVAL_MS);
  }

  async sync() {
    this.logger.log('Syncing airports from Ryanair...');
    try {
      const res = await fetch(AIRPORTS_URL);
      const airports: RyanairAirport[] = (await res.json()) as RyanairAirport[];

      await prisma.$transaction(
        airports
          .filter((a) => a.code && a.city?.name)
          .map((a) =>
            prisma.airport.upsert({
              where: { iata: a.code },
              update: {
                name: a.city.name,
                country: a.country.code,
                isPolish: a.country.code === 'PL',
              },
              create: {
                iata: a.code,
                name: a.city.name,
                country: a.country.code,
                isPolish: a.country.code === 'PL',
              },
            }),
          ),
      );

      // Sync routes for each Polish airport
      await prisma.airportRoute.deleteMany({
        where: { fromIata: { in: POLISH_IATAS } },
      });
      const routeRows: { fromIata: string; toIata: string }[] = [];

      for (const iata of POLISH_IATAS) {
        try {
          const r = await fetch(ROUTES_URL(iata));
          const routes: RyanairRoute[] = (await r.json()) as RyanairRoute[];
          for (const route of routes) {
            if (route.arrivalAirport?.code)
              routeRows.push({
                fromIata: iata,
                toIata: route.arrivalAirport.code,
              });
          }
        } catch {
          this.logger.warn(`Routes fetch failed for ${iata}`);
        }
      }

      if (routeRows.length > 0)
        await prisma.airportRoute.createMany({
          data: routeRows,
          skipDuplicates: true,
        });

      await prisma.airportSync.upsert({
        where: { id: 'main' },
        update: { syncedAt: new Date() },
        create: { id: 'main', syncedAt: new Date() },
      });

      this.logger.log(
        `Synced ${airports.length} airports, ${routeRows.length} routes`,
      );
    } catch (err) {
      this.logger.error('Airport sync failed', err);
    }
  }

  findAll() {
    return prisma.airport.findMany({
      orderBy: [{ isPolish: 'desc' }, { name: 'asc' }],
    });
  }

  routesFrom(fromIata: string) {
    return prisma.airportRoute.findMany({ where: { fromIata } });
  }
}
