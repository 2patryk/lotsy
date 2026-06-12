import { Controller, Get, Param, Post } from '@nestjs/common';
import { AirportsService } from './airports.service.js';

@Controller('airports')
export class AirportsController {
  constructor(private readonly airportsService: AirportsService) {}

  @Get()
  findAll() {
    return this.airportsService.findAll();
  }

  @Get(':iata/routes')
  routesFrom(@Param('iata') iata: string) {
    return this.airportsService.routesFrom(iata.toUpperCase());
  }

  @Post('sync')
  sync() {
    void this.airportsService.sync();
    return { status: 'sync started' };
  }
}
