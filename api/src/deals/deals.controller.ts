import {
  Controller,
  Get,
  Param,
  Query,
  NotFoundException,
} from '@nestjs/common';
import { DealsService } from './deals.service.js';

@Controller()
export class DealsController {
  constructor(private readonly dealsService: DealsService) {}

  @Get('deals')
  findAll(
    @Query('destCountry') destCountry?: string,
    @Query('maxPrice') maxPrice?: string,
    @Query('origin') origin?: string,
    @Query('sort') sort?: 'price' | 'departure' | 'duration',
    @Query('levels') levels?: string,
    @Query('minNights') minNights?: string,
    @Query('maxNights') maxNights?: string,
    @Query('perCountry') perCountry?: string,
    @Query('depDays') depDays?: string,
    @Query('retDays') retDays?: string,
    @Query('depTimes') depTimes?: string,
    @Query('retTimes') retTimes?: string,
  ) {
    return this.dealsService.findAll({
      destCountry,
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
      origin,
      sort,
      levels: levels ? levels.split(',').map(Number) : undefined,
      minNights: minNights ? Number(minNights) : undefined,
      maxNights: maxNights ? Number(maxNights) : undefined,
      perCountry: perCountry ? Number(perCountry) : undefined,
      depDays: depDays ? depDays.split(',').map(Number) : undefined,
      retDays: retDays ? retDays.split(',').map(Number) : undefined,
      depTimes: depTimes ? depTimes.split(',') : undefined,
      retTimes: retTimes ? retTimes.split(',') : undefined,
    });
  }

  @Get('deals/:id')
  async findOne(@Param('id') id: string) {
    const deal = await this.dealsService.findOne(id);
    if (!deal) throw new NotFoundException(`Deal ${id} not found`);
    return deal;
  }

  @Get('health')
  async health() {
    const lastRun = await this.dealsService.getLastSuccessfulRun();
    return {
      status: 'ok',
      lastSuccessfulRun: lastRun?.finishedAt ?? null,
      dealsFound: lastRun?.dealsFound ?? 0,
    };
  }
}
