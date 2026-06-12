import { Module } from '@nestjs/common';
import { DealsModule } from './deals/deals.module.js';
import { AirportsModule } from './airports/airports.module.js';
import { CityImagesModule } from './city-images/city-images.module.js';

@Module({
  imports: [DealsModule, AirportsModule, CityImagesModule],
})
export class AppModule {}
