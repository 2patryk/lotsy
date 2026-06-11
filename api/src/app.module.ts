import { Module } from '@nestjs/common';
import { DealsModule } from './deals/deals.module.js';

@Module({
  imports: [DealsModule],
})
export class AppModule {}
