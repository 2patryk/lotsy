import { Controller, Get, Query } from '@nestjs/common';
import {
  OneWayService,
  type OneWayDirection,
  type OneWayFaresSort,
} from './oneway.service.js';

function csv(value?: string): string[] | undefined {
  return value
    ? value
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean)
    : undefined;
}

function toDirection(value?: string): OneWayDirection {
  return value === 'in' ? 'in' : 'out';
}

@Controller('oneway')
export class OneWayController {
  constructor(private readonly oneWayService: OneWayService) {}

  @Get('fares')
  findFares(
    @Query('direction') direction?: string,
    @Query('plAirport') plAirport?: string,
    @Query('country') country?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('days') days?: string,
    @Query('minPrice') minPrice?: string,
    @Query('maxPrice') maxPrice?: string,
    @Query('sort') sort?: OneWayFaresSort,
  ) {
    return this.oneWayService.findFares({
      direction: toDirection(direction),
      plAirport: csv(plAirport)?.map((a) => a.toUpperCase()),
      country: csv(country),
      dateFrom,
      dateTo,
      days: csv(days)?.map(Number),
      minPrice: minPrice ? Number(minPrice) : undefined,
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
      sort,
    });
  }

  @Get('meta')
  getMeta(@Query('direction') direction?: string) {
    return this.oneWayService.getMeta(toDirection(direction));
  }
}
