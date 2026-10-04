import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  SkipUserId,
  CurrentUserId,
  ResponseMessage,
} from '../common/decorators/index.js';
import { ApiFailureResponseDto } from '../common/http/index.js';
import { UpdateUserDto } from './dto/index.js';
import { UsersService } from './users.service.js';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @SkipUserId()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Disabled anonymous registration',
    description:
      'Users are created by POST /auth/register or POST /auth/google. This route no longer creates a user.',
  })
  @ApiResponse({
    status: 201,
    description: 'User created (wrapped in envelope)',
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error',
    type: ApiFailureResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: 'Email already in use',
    type: ApiFailureResponseDto,
  })
  @ApiResponse({
    status: 429,
    description: 'Too many requests',
    type: ApiFailureResponseDto,
  })
  create() {
    throw new ForbiddenException(
      'Anonymous registration is disabled. Use auth sign-up.',
    );
  }

  @Get('me')
  @ApiBearerAuth()
  @ResponseMessage('OK')
  @ApiOperation({ summary: 'Get current user from bearer token' })
  @ApiResponse({ status: 200, description: 'Current user (envelope)' })
  @ApiResponse({
    status: 400,
    description: 'Missing/invalid bearer token',
    type: ApiFailureResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
    type: ApiFailureResponseDto,
  })
  me(@CurrentUserId() userId: string) {
    return this.usersService.findMe(userId);
  }

  @Delete('me')
  @HttpCode(200)
  @ApiBearerAuth()
  @ResponseMessage('Cuenta y todos los datos eliminados')
  @ApiOperation({
    summary: 'Wipe current user account and all related data',
    description:
      'DANGER: permanently deletes the User row and all owned data ' +
      '(expenses, credits, categories, processed inbound emails). ' +
      'Requires bearer token. Prefer this over DELETE /expenses for a full reset.',
  })
  @ApiResponse({ status: 200, description: 'Account wiped (envelope)' })
  @ApiResponse({
    status: 400,
    description: 'Missing/invalid bearer token',
    type: ApiFailureResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
    type: ApiFailureResponseDto,
  })
  wipeMe(@CurrentUserId() userId: string) {
    return this.usersService.wipeMe(userId);
  }

  @Get(':id')
  @ApiBearerAuth()
  @ResponseMessage('OK')
  @ApiOperation({ summary: 'Get user by id (must match bearer token)' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUserId() userId: string,
  ) {
    return this.usersService.findOne(id, userId);
  }

  @Patch('me')
  @ApiBearerAuth()
  @ResponseMessage('Usuario actualizado correctamente')
  @ApiOperation({
    summary: 'Update name, budget, email, and/or emailAppToken',
  })
  @ApiResponse({ status: 200, description: 'Updated user (envelope)' })
  @ApiResponse({
    status: 400,
    description: 'Validation error',
    type: ApiFailureResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
    type: ApiFailureResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: 'Email already in use',
    type: ApiFailureResponseDto,
  })
  updateMe(@CurrentUserId() userId: string, @Body() dto: UpdateUserDto) {
    return this.usersService.updateMe(userId, dto);
  }
}
