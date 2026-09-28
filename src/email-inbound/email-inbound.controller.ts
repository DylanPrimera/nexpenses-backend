import { Controller, HttpCode, Post } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CurrentUserId,
  ResponseMessage,
} from '../common/decorators/index.js';
import { EmailInboundService } from './email-inbound.service.js';

@ApiTags('Email inbound')
@ApiHeader({ name: 'X-User-Id', required: true })
@Controller('email-inbound')
export class EmailInboundController {
  constructor(private readonly emailInboundService: EmailInboundService) {}

  @Post('sync')
  @HttpCode(200)
  @ResponseMessage('Sincronización de correos completada')
  @ApiOperation({
    summary: 'Sincronizar gastos desde correos reenviados (manual)',
    description:
      'Conecta al buzón IMAP compartido, procesa solo mensajes dirigidos a este userId ' +
      '(plus-address nexpensesdev+{userId}@gmail.com o subject nexpenses:UUID), ' +
      'crea gastos cuando hay monto, y limpia mails ya procesados tras ~1h. ' +
      'Respuesta data: { created, skipped, deleted, errors, skippedByReason }.',
  })
  sync(@CurrentUserId() userId: string) {
    return this.emailInboundService.syncForUser(userId);
  }
}
