import { Module } from '@nestjs/common';
import { OneWayController } from './oneway.controller.js';
import { OneWayService } from './oneway.service.js';

@Module({
  controllers: [OneWayController],
  providers: [OneWayService],
})
export class OneWayModule {}
