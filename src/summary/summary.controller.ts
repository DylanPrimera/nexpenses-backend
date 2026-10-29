import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUserId, ResponseMessage } from '../common/decorators/index.js';
import { SummaryQueryDto } from './dto/index.js';
import { SummaryService } from './summary.service.js';

@ApiTags('Summary')
@ApiBearerAuth()
@Controller('summary')
export class SummaryController {
  constructor(private readonly summaryService: SummaryService) {}

  @Get()
  @ResponseMessage('OK')
  @ApiOperation({
    summary: 'Cycle / expense summary',
    description:
      'Default (no year/month): current budget cycle — expenses dated on/after user.cycleStartedAt vs user.budget; ' +
      'daysLeft counts to the expected end (one month after the start) and isCycleStale flags 35+ days. ' +
      'Monthly scope (year+month): remaining/percentage vs user.budget (monthly). ' +
      'Year scope (year only): spent vs projectedAnnualBudget (budget×12); ' +
      'returns budgetMonthly + projectedAnnualBudget. daysLeft only for the current month. Calendar ranges use America/Bogota.',
  })
  getSummary(@CurrentUserId() userId: string, @Query() query: SummaryQueryDto) {
    return this.summaryService.getSummary(userId, query);
  }
}
