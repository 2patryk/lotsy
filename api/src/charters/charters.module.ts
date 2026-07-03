import { Module } from '@nestjs/common';
import { ChartersController } from './charters.controller.js';
import { ChartersService } from './charters.service.js';

@Module({
  controllers: [ChartersController],
  providers: [ChartersService],
})
export class ChartersModule {}
