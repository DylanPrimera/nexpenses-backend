import { Module } from '@nestjs/common';
import { ExpensesModule } from '../expenses/expenses.module.js';
import { BusinessExpensesController } from './business-expenses.controller.js';
import { BusinessExpensesService } from './business-expenses.service.js';
import { BusinessController } from './business.controller.js';
import { BusinessService } from './business.service.js';

@Module({
  imports: [ExpensesModule],
  controllers: [BusinessController, BusinessExpensesController],
  providers: [BusinessService, BusinessExpensesService],
})
export class BusinessModule {}
