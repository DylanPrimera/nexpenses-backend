import { Module } from '@nestjs/common';
import { CreditsController } from './credits.controller.js';
import { CreditsService } from './credits.service.js';
import { StatementFileService } from './statement-file.service.js';

@Module({
  controllers: [CreditsController],
  providers: [CreditsService, StatementFileService],
  exports: [CreditsService],
})
export class CreditsModule {}
