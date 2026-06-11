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
  ) {
    return this.dealsService.findAll({
      destCountry,
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
      origin,
      sort,
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
