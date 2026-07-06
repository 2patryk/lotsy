import { Controller, Get, Query } from '@nestjs/common';
import {
  OneWayService,
  type OneWayDirection,
  type OneWayFaresSort,
} from './oneway.service.js';
import { OnwardService } from './onward.service.js';

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
  constructor(
    private readonly oneWayService: OneWayService,
    private readonly onwardService: OnwardService,
  ) {}

  // Live onward/feeder connections for an airport, fetched on demand from
  // the carrier APIs (not from the synced OneWayFare table).
  @Get('onward')
  getOnward(
    @Query('airport') airport?: string,
    @Query('date') date?: string,
    @Query('carrier') carrier?: string,
    @Query('mode') mode?: string,
    @Query('windowStart') windowStart?: string,
  ) {
    return this.onwardService.getOnward({
      airport,
      date,
      carrier,
      mode,
      windowStart,
    });
  }

  @Get('fares')
  findFares(
    @Query('direction') direction?: string,
    @Query('plAirport') plAirport?: string,
    @Query('country') country?: string,
    @Query('city') city?: string,
    @Query('airport') airport?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('days') days?: string,
    @Query('minPrice') minPrice?: string,
    @Query('maxPrice') maxPrice?: string,
    @Query('sort') sort?: OneWayFaresSort,
    @Query('source') source?: string,
  ) {
    return this.oneWayService.findFares({
      direction: toDirection(direction),
      plAirport: csv(plAirport)?.map((a) => a.toUpperCase()),
      country: csv(country),
      city: csv(city),
      airport: csv(airport)?.map((a) => a.toUpperCase()),
      dateFrom,
      dateTo,
      days: csv(days)?.map(Number),
      minPrice: minPrice ? Number(minPrice) : undefined,
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
      sort,
      source: csv(source)?.map((s) => s.toUpperCase()),
    });
  }

  @Get('meta')
  getMeta(@Query('direction') direction?: string) {
    return this.oneWayService.getMeta(toDirection(direction));
  }
}
