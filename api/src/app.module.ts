import { Module } from '@nestjs/common';
import { DealsModule } from './deals/deals.module.js';
import { AirportsModule } from './airports/airports.module.js';
import { CityImagesModule } from './city-images/city-images.module.js';
import { ChartersModule } from './charters/charters.module.js';
import { OneWayModule } from './oneway/oneway.module.js';

@Module({
  imports: [
    DealsModule,
    AirportsModule,
    CityImagesModule,
    ChartersModule,
    OneWayModule,
  ],
})
export class AppModule {}
