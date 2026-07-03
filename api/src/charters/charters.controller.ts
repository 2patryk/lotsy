import { Controller, Get, Query } from '@nestjs/common';
import { ChartersService, type CharterSort } from './charters.service.js';

@Controller()
export class ChartersController {
  constructor(private readonly chartersService: ChartersService) {}

  @Get('charters')
  async findAll(
    @Query('sort') sort?: CharterSort,
    @Query('country') country?: string,
  ) {
    const [offers, lastUpdate] = await Promise.all([
      this.chartersService.findAll({ sort, country }),
      this.chartersService.getLastUpdate(),
    ]);
    return { offers, lastUpdate };
  }
}
