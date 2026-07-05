import { Module } from '@nestjs/common';
import { OneWayController } from './oneway.controller.js';
import { OneWayService } from './oneway.service.js';
import { OnwardService } from './onward.service.js';

@Module({
  controllers: [OneWayController],
  providers: [OneWayService, OnwardService],
})
export class OneWayModule {}
