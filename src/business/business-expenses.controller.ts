import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUserId, ResponseMessage } from '../common/decorators/index.js';
import { ApiFailureResponseDto } from '../common/http/index.js';
import { BusinessExpensesService } from './business-expenses.service.js';
import {
  BusinessIncomesQueryDto,
  BusinessSummaryQueryDto,
  CreateBusinessExpenseDto,
  UpdateBusinessExpenseDto,
} from './dto/index.js';

@ApiTags('Business')
@ApiBearerAuth()
@Controller('business')
export class BusinessExpensesController {
  constructor(private readonly service: BusinessExpensesService) {}

  @Get('expenses')
  @ResponseMessage('OK')
  @ApiOperation({
    summary: 'List business expenses of a month',
    description:
      'Response data shape: { items, total, limit, offset }. Order: spentOn DESC, createdAt DESC, id DESC.',
  })
  list(
    @CurrentUserId() userId: string,
    @Query() query: BusinessIncomesQueryDto,
  ) {
    return this.service.listExpenses(userId, query);
  }

  @Post('expenses')
  @ResponseMessage('Gasto del negocio registrado')
  @ApiOperation({
    summary:
      'Register a business expense (idempotent by client id); optionally also a personal expense',
  })
  @ApiResponse({
    status: 409,
    description: 'ID_CONFLICT',
    type: ApiFailureResponseDto,
  })
  create(
    @CurrentUserId() userId: string,
    @Body() dto: CreateBusinessExpenseDto,
  ) {
    return this.service.createExpense(userId, dto);
  }

  @Patch('expenses/:id')
  @ResponseMessage('Gasto del negocio actualizado')
  @ApiOperation({
    summary:
      'Edit a business expense; the linked personal expense is overwritten, created or removed',
  })
  @ApiResponse({
    status: 404,
    description: 'BUSINESS_EXPENSE_NOT_FOUND',
    type: ApiFailureResponseDto,
  })
  update(
    @CurrentUserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBusinessExpenseDto,
  ) {
    return this.service.updateExpense(userId, id, dto);
  }

  @Delete('expenses/:id')
  @HttpCode(200)
  @ResponseMessage('Gasto del negocio eliminado')
  @ApiOperation({
    summary: 'Delete a business expense and its linked personal expense',
  })
  @ApiResponse({
    status: 404,
    description: 'BUSINESS_EXPENSE_NOT_FOUND',
    type: ApiFailureResponseDto,
  })
  remove(
    @CurrentUserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.deleteExpense(userId, id);
  }

  @Get('balance')
  @ResponseMessage('OK')
  @ApiOperation({
    summary: 'Calendar-month business balance',
    description:
      'Response data shape: { month, totalIncome, totalExpenses, result }. Counts every income and expense of the month.',
  })
  balance(
    @CurrentUserId() userId: string,
    @Query() query: BusinessSummaryQueryDto,
  ) {
    return this.service.getBalance(userId, query.month);
  }
}
