import { Controller, Get, Query } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CurrentUserId,
  ResponseMessage,
} from '../common/decorators/index.js';
import { SummaryQueryDto } from './dto/index.js';
import { SummaryService } from './summary.service.js';

@ApiTags('Summary')
@ApiHeader({ name: 'X-User-Id', required: true })
@Controller('summary')
export class SummaryController {
  constructor(private readonly summaryService: SummaryService) {}

  @Get()
  @ResponseMessage('OK')
  @ApiOperation({
    summary: 'Cycle / expense summary',
    description:
      'Monthly scope (year+month): remaining/percentage vs user.budget (monthly). ' +
      'Year scope (year only): spent vs projectedAnnualBudget (budget×12); ' +
      'returns budgetMonthly + projectedAnnualBudget. daysLeft only for the current month.',
  })
  getSummary(
    @CurrentUserId() userId: string,
    @Query() query: SummaryQueryDto,
  ) {
    return this.summaryService.getSummary(userId, query);
  }
}
