import { Module } from '@nestjs/common';
import { CategoriesModule } from '../categories/categories.module.js';
import { ExpensesModule } from '../expenses/expenses.module.js';
import { EmailInboundController } from './email-inbound.controller.js';
import { EmailInboundService } from './email-inbound.service.js';

@Module({
  imports: [ExpensesModule, CategoriesModule],
  controllers: [EmailInboundController],
  providers: [EmailInboundService],
})
export class EmailInboundModule {}
