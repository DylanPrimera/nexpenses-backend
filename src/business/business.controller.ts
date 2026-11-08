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
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUserId, ResponseMessage } from '../common/decorators/index.js';
import { ApiFailureResponseDto } from '../common/http/index.js';
import {
  BusinessIncomesQueryDto,
  BusinessNameDto,
  BusinessSummaryQueryDto,
  CreateBusinessIncomeDto,
  UpdateBusinessIncomeDto,
} from './dto/index.js';
import { BusinessService } from './business.service.js';

@ApiTags('Business')
@ApiBearerAuth()
@Controller('business')
export class BusinessController {
  constructor(private readonly businessService: BusinessService) {}

  @Get()
  @ResponseMessage('OK')
  @ApiOperation({ summary: 'Get the current user business', description: 'Response data shape: { business: { id, name } | null }.' })
  get(@CurrentUserId() userId: string) {
    return this.businessService.getBusiness(userId);
  }

  @Post()
  @ResponseMessage('Negocio creado')
  @ApiOperation({ summary: 'Create the business (one per user)' })
  @ApiResponse({ status: 409, description: 'BUSINESS_EXISTS', type: ApiFailureResponseDto })
  create(@CurrentUserId() userId: string, @Body() dto: BusinessNameDto) {
    return this.businessService.createBusiness(userId, dto.name);
  }

  @Patch()
  @ResponseMessage('Negocio actualizado')
  @ApiOperation({ summary: 'Rename the business' })
  rename(@CurrentUserId() userId: string, @Body() dto: BusinessNameDto) {
    return this.businessService.renameBusiness(userId, dto.name);
  }

  @Delete()
  @HttpCode(200)
  @ResponseMessage('Negocio eliminado')
  @ApiOperation({
    summary: 'Delete the business and all its incomes',
    description: 'Amounts already added to the current personal cycle are kept (keptInPersonal).',
  })
  remove(@CurrentUserId() userId: string) {
    return this.businessService.deleteBusiness(userId);
  }

  @Get('incomes')
  @ResponseMessage('OK')
  @ApiOperation({
    summary: 'List business incomes of a month',
    description: 'Response data shape: { items, total, limit, offset }. Order: collectedOn DESC, createdAt DESC.',
  })
  listIncomes(@CurrentUserId() userId: string, @Query() query: BusinessIncomesQueryDto) {
    return this.businessService.listIncomes(userId, query);
  }

  @Get('summary')
  @ResponseMessage('OK')
  @ApiOperation({ summary: 'Totals of a month by collection date', description: 'Response data shape: { month, collected, addedToPersonal }.' })
  summary(@CurrentUserId() userId: string, @Query() query: BusinessSummaryQueryDto) {
    return this.businessService.getSummary(userId, query.month);
  }

  @Post('incomes')
  @ResponseMessage('Ingreso registrado')
  @ApiOperation({ summary: 'Register an income (idempotent by client id)' })
  createIncome(@CurrentUserId() userId: string, @Body() dto: CreateBusinessIncomeDto) {
    return this.businessService.createIncome(userId, dto);
  }

  @Patch('incomes/:id')
  @ResponseMessage('Ingreso actualizado')
  @ApiOperation({ summary: 'Edit title, description, client or the add-to-personal flag' })
  updateIncome(
    @CurrentUserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBusinessIncomeDto,
  ) {
    return this.businessService.updateIncome(userId, id, dto);
  }

  @Delete('incomes/:id')
  @ResponseMessage('Ingreso eliminado')
  @ApiOperation({ summary: 'Delete an income' })
  deleteIncome(@CurrentUserId() userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.businessService.deleteIncome(userId, id);
  }
}
