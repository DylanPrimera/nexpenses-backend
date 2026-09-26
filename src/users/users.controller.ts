import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiHeader,
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
import { PaginationDto } from '../common/dtos/pagination.dto.js';
import { ApiFailureResponseDto } from '../common/http/index.js';
import { CreateUserDto, UpdateUserDto } from './dto/index.js';
import { UsersService } from './users.service.js';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @SkipUserId()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ResponseMessage('Usuario creado correctamente')
  @ApiOperation({
    summary: 'Create user (first visit — no X-User-Id required)',
    description:
      'Accepts name + budget and optional email / emailAppToken. Rate-limited to 10 requests/minute. ' +
      'Response envelope: { success, data: User, message }.',
  })
  @ApiResponse({ status: 201, description: 'User created (wrapped in envelope)' })
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
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Get()
  @ApiHeader({ name: 'X-User-Id', required: true })
  @ResponseMessage('OK')
  @ApiOperation({
    summary: 'List all users (Postman / manual testing only)',
    description:
      'Returns paginated users ordered by createdAt desc. Omits emailAppToken. Requires X-User-Id. ' +
      'data shape: { items, total, limit, offset }. Intended for local Postman testing — not for production clients.',
  })
  @ApiResponse({ status: 200, description: 'Paginated user list (envelope)' })
  @ApiResponse({ status: 400, description: 'Missing/invalid X-User-Id', type: ApiFailureResponseDto })
  @ApiResponse({ status: 404, description: 'User not found', type: ApiFailureResponseDto })
  findAll(@Query() pagination: PaginationDto) {
    return this.usersService.findAll(pagination);
  }

  @Get('me')
  @ApiHeader({ name: 'X-User-Id', required: true })
  @ResponseMessage('OK')
  @ApiOperation({ summary: 'Get current user from X-User-Id' })
  @ApiResponse({ status: 200, description: 'Current user (envelope)' })
  @ApiResponse({ status: 400, description: 'Missing/invalid X-User-Id', type: ApiFailureResponseDto })
  @ApiResponse({ status: 404, description: 'User not found', type: ApiFailureResponseDto })
  me(@CurrentUserId() userId: string) {
    return this.usersService.findMe(userId);
  }

  @Get(':id')
  @ApiHeader({ name: 'X-User-Id', required: true })
  @ResponseMessage('OK')
  @ApiOperation({ summary: 'Get user by id (must match X-User-Id)' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUserId() userId: string,
  ) {
    return this.usersService.findOne(id, userId);
  }

  @Patch('me')
  @ApiHeader({ name: 'X-User-Id', required: true })
  @ResponseMessage('Usuario actualizado correctamente')
  @ApiOperation({
    summary: 'Update name, budget, email, and/or emailAppToken',
  })
  @ApiResponse({ status: 200, description: 'Updated user (envelope)' })
  @ApiResponse({ status: 400, description: 'Validation error', type: ApiFailureResponseDto })
  @ApiResponse({ status: 404, description: 'User not found', type: ApiFailureResponseDto })
  @ApiResponse({ status: 409, description: 'Email already in use', type: ApiFailureResponseDto })
  updateMe(@CurrentUserId() userId: string, @Body() dto: UpdateUserDto) {
    return this.usersService.updateMe(userId, dto);
  }
}
