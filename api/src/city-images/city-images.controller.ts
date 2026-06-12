import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { CityImagesService } from './city-images.service.js';

@Controller('city-images')
export class CityImagesController {
  constructor(private readonly cityImagesService: CityImagesService) {}

  @Get()
  getBatch(@Query('cities') cities?: string) {
    if (!cities) throw new BadRequestException('cities query param required');
    const list = cities
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean)
      .slice(0, 50); // safety cap
    return this.cityImagesService.getBatch(list);
  }
}
