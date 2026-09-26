import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { ResponseMessage, SkipUserId } from './common/decorators/index.js';
import { AppService } from './app.service.js';

@ApiTags('Health')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  @SkipUserId()
  @SkipThrottle()
  @ResponseMessage('OK')
  @ApiOperation({
    summary: 'Health check (public, not rate-limited)',
    description:
      'Wrapped in the standard envelope: { success, data: { status, service, timestamp }, message }.',
  })
  getHealth() {
    return this.appService.getHealth();
  }
}
