import { Module } from '@nestjs/common';
import { CityImagesController } from './city-images.controller.js';
import { CityImagesService } from './city-images.service.js';

@Module({
  controllers: [CityImagesController],
  providers: [CityImagesService],
})
export class CityImagesModule {}
