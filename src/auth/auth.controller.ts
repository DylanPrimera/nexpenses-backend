import { Body, Controller, Get, HttpCode, Post, UnauthorizedException } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  CurrentUserId,
  ResponseMessage,
  SkipUserId,
} from '../common/decorators/index.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthService, publicUserSelect } from './auth.service.js';
import { GoogleDto } from './dto/google.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { MigrateDto } from './dto/migrate.dto.js';
import { RegisterDto } from './dto/register.dto.js';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('register')
  @SkipUserId()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ResponseMessage('Cuenta creada')
  @ApiOperation({ summary: 'Register with email and password' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @SkipUserId()
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ResponseMessage('Sesión iniciada')
  @ApiOperation({ summary: 'Login with email and password' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('google')
  @SkipUserId()
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ResponseMessage('Sesión iniciada')
  @ApiOperation({
    summary: 'Sign in with a Google ID token',
    description:
      'Verifies a Google Identity Services credential. Does not link a Google identity to an existing password account.',
  })
  google(@Body() dto: GoogleDto) {
    return this.authService.google(dto);
  }

  @Post('migrate')
  @SkipUserId()
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ResponseMessage('Cuenta vinculada')
  @ApiOperation({
    summary: 'Attach email/password or Google to an existing user id',
  })
  migrate(@Body() dto: MigrateDto) {
    return this.authService.migrate(dto);
  }

  @Get('me')
  @ApiBearerAuth()
  @ResponseMessage('OK')
  @ApiOperation({ summary: 'Current user and a refreshed long-lived JWT' })
  async me(@CurrentUserId() userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: publicUserSelect,
    });
    if (!user) throw new UnauthorizedException('Token not valid');
    return this.authService.me(user);
  }
}
