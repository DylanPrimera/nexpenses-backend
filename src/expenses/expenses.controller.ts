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
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUserId, ResponseMessage } from '../common/decorators/index.js';
import { PaginationDto } from '../common/dtos/pagination.dto.js';
import {
  CreateExpenseDto,
  FilterExpensesDto,
  UpdateExpenseDto,
} from './dto/index.js';
import { ExpensesService } from './expenses.service.js';

@ApiTags('Expenses')
@ApiHeader({ name: 'X-User-Id', required: true })
@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Post()
  @ResponseMessage('Gasto creado correctamente')
  @ApiOperation({ summary: 'Create expense' })
  create(@CurrentUserId() userId: string, @Body() dto: CreateExpenseDto) {
    return this.expensesService.create(userId, dto);
  }

  @Get()
  @ResponseMessage('OK')
  @ApiOperation({
    summary: 'List expenses with filters and pagination',
    description:
      'Filters: year, month (1–12), categoryId, paymentType, search, limit, offset. ' +
      'Response data shape: { items, total, limit, offset }. ' +
      'Expenses are kept across months by default (no automatic wipe).',
  })
  findAll(
    @CurrentUserId() userId: string,
    @Query() filters: FilterExpensesDto,
  ) {
    return this.expensesService.findAll(userId, filters);
  }

  @Get('recurring')
  @ResponseMessage('OK')
  @ApiOperation({
    summary: 'List recurring expense templates',
    description:
      'Reusable payments owned by the user. Response data shape: { items, total, limit, offset }.',
  })
  listRecurring(
    @CurrentUserId() userId: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.expensesService.listRecurring(userId, pagination);
  }

  @Delete('recurring/:id')
  @ResponseMessage('Pago recurrente eliminado')
  @ApiOperation({ summary: 'Delete a recurring expense template' })
  removeRecurring(
    @CurrentUserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.expensesService.removeRecurring(userId, id);
  }

  @Delete()
  @HttpCode(200)
  @ResponseMessage('Todos los gastos fueron eliminados')
  @ApiOperation({
    summary: 'Wipe all expenses for current user (legacy)',
    description:
      'DANGER: deletes ALL expenses for this user and restores linked credit balances. ' +
      'Does NOT delete credits, categories, or the User. Prefer DELETE /users/me for a full account wipe.',
  })
  wipeAll(@CurrentUserId() userId: string) {
    return this.expensesService.wipeAll(userId);
  }

  @Get(':id')
  @ResponseMessage('OK')
  @ApiOperation({ summary: 'Get expense by id' })
  findOne(
    @CurrentUserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.expensesService.findOne(userId, id);
  }

  @Patch(':id')
  @ResponseMessage('Gasto actualizado correctamente')
  @ApiOperation({ summary: 'Update expense' })
  update(
    @CurrentUserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateExpenseDto,
  ) {
    return this.expensesService.update(userId, id, dto);
  }

  @Delete(':id')
  @ResponseMessage('Gasto eliminado correctamente')
  @ApiOperation({ summary: 'Delete expense' })
  remove(
    @CurrentUserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.expensesService.remove(userId, id);
  }
}
