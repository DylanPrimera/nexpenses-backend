import { Controller, Get, Query } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CurrentUserId,
  ResponseMessage,
} from '../common/decorators/index.js';
import { YearlyHistoryQueryDto } from './dto/index.js';
import { HistoryService } from './history.service.js';

@ApiTags('History')
@ApiHeader({ name: 'X-User-Id', required: true })
@Controller('history')
export class HistoryController {
  constructor(private readonly historyService: HistoryService) {}

  @Get('yearly')
  @ResponseMessage('OK')
  @ApiOperation({
    summary: 'Yearly monthly breakdown',
    description:
      'Returns spent + expenseCount + isOverBudget per calendar month for the given year. ' +
      'Expenses are retained across months (no automatic wipe).',
  })
  getYearly(
    @CurrentUserId() userId: string,
    @Query() query: YearlyHistoryQueryDto,
  ) {
    return this.historyService.getYearly(userId, query);
  }
}
