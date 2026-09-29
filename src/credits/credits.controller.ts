import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiHeader,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUserId, ResponseMessage } from '../common/decorators/index.js';
import { CreditsService } from './credits.service.js';
import {
  MAX_STATEMENT_BYTES,
  type UploadedPdf,
} from './statement-file.service.js';
import {
  CreateCreditDto,
  FilterCreditsDto,
  FromStatementDto,
  UpdateCreditDto,
} from './dto/index.js';

@ApiTags('Credits')
@ApiHeader({ name: 'X-User-Id', required: true })
@Controller('credits')
export class CreditsController {
  constructor(private readonly creditsService: CreditsService) {}

  @Post()
  @ResponseMessage('Crédito creado correctamente')
  @ApiOperation({
    summary: 'Create a credit manually (no statement PDF)',
    description:
      'Use when the user enters essentials by hand or after a failed PDF parse. ' +
      'Required: kind, displayName, bankName, nextPaymentDate, remainingBalance, and ' +
      'minPayment (TC) or installmentAmount (CONSUMO). ' +
      'provider defaults to GENERIC. ' +
      'Rates EA/MV are optional. Maximum 10 credits per user.',
  })
  create(@CurrentUserId() userId: string, @Body() dto: CreateCreditDto) {
    return this.creditsService.create(userId, dto);
  }

  @Get()
  @ResponseMessage('OK')
  @ApiOperation({
    summary: 'List credits',
    description:
      'Each item includes status: atrasado, proximo (due within 7 days) or al_dia. ' +
      'data shape: { items, total, limit, offset }.',
  })
  findAll(@CurrentUserId() userId: string, @Query() filters: FilterCreditsDto) {
    return this.creditsService.findAll(userId, filters);
  }

  @Post('from-statement')
  @ResponseMessage('Crédito registrado desde el extracto')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['kind', 'file'],
      properties: {
        kind: { type: 'string', enum: ['TC', 'CONSUMO'] },
        displayName: { type: 'string' },
        bankName: { type: 'string' },
        rateEa: { type: 'number' },
        rateMv: { type: 'number' },
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiOperation({
    summary: 'Create a credit from a single statement PDF',
    description:
      'The PDF is staged on temporary disk, parsed, and deleted immediately. ' +
      'No PDF URL is stored. Rates sent in the form override rates read from the PDF. ' +
      'Maximum 10 credits per user.',
  })
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_STATEMENT_BYTES } }),
  )
  fromStatement(
    @CurrentUserId() userId: string,
    @Body() dto: FromStatementDto,
    @UploadedFile() file: UploadedPdf,
  ) {
    return this.creditsService.createFromStatement(userId, dto, file);
  }

  @Get('total')
  @ResponseMessage('OK')
  @ApiOperation({
    summary: 'Sum of remaining balances for the current user',
    description:
      'Returns { totalBalance } = sum of Credit.remainingBalance for the authenticated user.',
  })
  getTotalBalance(@CurrentUserId() userId: string) {
    return this.creditsService.getTotalBalance(userId);
  }

  @Get(':id')
  @ResponseMessage('OK')
  @ApiOperation({ summary: 'Get credit by id' })
  findOne(
    @CurrentUserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.creditsService.findOne(userId, id);
  }

  @Patch(':id')
  @ResponseMessage('Crédito actualizado correctamente')
  @ApiOperation({
    summary: 'Update a credit',
    description:
      'Sending rateEa and/or rateMv recalculates period interest. ' +
      'For consumer loans with original amount, term and installment number, ' +
      'remaining balance and the projected installment are recalculated too. ' +
      'remainingBalance can only be patched for credit cards (TC).',
  })
  update(
    @CurrentUserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCreditDto,
  ) {
    return this.creditsService.update(userId, id, dto);
  }

  @Delete(':id')
  @ResponseMessage('Crédito eliminado correctamente')
  @ApiOperation({ summary: 'Delete a credit' })
  remove(
    @CurrentUserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.creditsService.remove(userId, id);
  }
}
