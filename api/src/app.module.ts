import { Module } from '@nestjs/common';
import { DealsModule } from './deals/deals.module.js';
import { AirportsModule } from './airports/airports.module.js';

@Module({
  imports: [DealsModule, AirportsModule],
})
export class AppModule {}
