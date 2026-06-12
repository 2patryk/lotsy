import { Injectable, Logger } from '@nestjs/common';
import { prisma } from '@lotsy/db';

const UNSPLASH_URL = 'https://api.unsplash.com/search/photos';
const UNSPLASH_KEY = process.env.UNSPLASH_ACCESS_KEY ?? '';

@Injectable()
export class CityImagesService {
  private readonly logger = new Logger(CityImagesService.name);

  async getBatch(cities: string[]): Promise<Record<string, string>> {
    if (!cities.length) return {};

    const cached = await prisma.cityImage.findMany({
      where: { city: { in: cities } },
    });

    const result: Record<string, string> = {};
    for (const row of cached) result[row.city] = row.imageUrl;

    const missing = cities.filter((c) => !result[c]);
    if (!missing.length) return result;

    if (!UNSPLASH_KEY) {
      this.logger.warn('UNSPLASH_ACCESS_KEY not set — skipping image fetch');
      return result;
    }

    // Fetch missing cities one by one; Unsplash has no batch search endpoint
    await Promise.all(
      missing.map(async (city) => {
        try {
          const url = `${UNSPLASH_URL}?query=${encodeURIComponent(city + ' city')}&per_page=1&orientation=landscape`;
          const res = await fetch(url, {
            headers: { Authorization: `Client-ID ${UNSPLASH_KEY}` },
          });
          if (!res.ok) return;

          const data = (await res.json()) as {
            results: { urls: { small: string } }[];
          };
          const imageUrl = data.results[0]?.urls?.small;
          if (!imageUrl) return;

          await prisma.cityImage.upsert({
            where: { city },
            update: { imageUrl, cachedAt: new Date() },
            create: { city, imageUrl, cachedAt: new Date() },
          });
          result[city] = imageUrl;
        } catch {
          this.logger.warn(`Failed to fetch image for "${city}"`);
        }
      }),
    );

    return result;
  }
}
