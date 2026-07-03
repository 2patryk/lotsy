import { Controller, Get, Query } from '@nestjs/common';
import {
  ChartersService,
  type CharterFlightsSort,
} from './charters.service.js';

function csv(value?: string): string[] | undefined {
  return value
    ? value
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean)
    : undefined;
}

@Controller()
export class ChartersController {
  constructor(private readonly chartersService: ChartersService) {}

  @Get('charters/flights')
  findFlights(
    @Query('oneWay') oneWay?: string,
    @Query('origin') origin?: string,
    @Query('destCountry') destCountry?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('days') days?: string,
    @Query('minPrice') minPrice?: string,
    @Query('maxPrice') maxPrice?: string,
    @Query('sort') sort?: CharterFlightsSort,
  ) {
    return this.chartersService.findFlights({
      oneWay: oneWay === 'true',
      origin: csv(origin)?.map((o) => o.toUpperCase()),
      destCountry: csv(destCountry),
      dateFrom,
      dateTo,
      days: csv(days)?.map(Number),
      minPrice: minPrice ? Number(minPrice) : undefined,
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
      sort,
    });
  }

  @Get('charters/meta')
  getMeta() {
    return this.chartersService.getMeta();
  }
}
