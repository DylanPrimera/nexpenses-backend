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
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CurrentUserId,
  ResponseMessage,
} from '../common/decorators/index.js';
import { PaginationDto } from '../common/dtos/pagination.dto.js';
import { CategoriesService } from './categories.service.js';
import {
  CreateCategoryDto,
  GetOrCreateCategoryDto,
  UpdateCategoryDto,
} from './dto/index.js';

@ApiTags('Categories')
@ApiHeader({ name: 'X-User-Id', required: true })
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  @ResponseMessage('Categoría creada correctamente')
  @ApiOperation({ summary: 'Create category' })
  create(@CurrentUserId() userId: string, @Body() dto: CreateCategoryDto) {
    return this.categoriesService.create(userId, dto);
  }

  @Get()
  @ResponseMessage('OK')
  @ApiOperation({
    summary: 'List categories for current user',
    description: 'Response data shape: { items, total, limit, offset }.',
  })
  findAll(@CurrentUserId() userId: string, @Query() pagination: PaginationDto) {
    return this.categoriesService.findAll(userId, pagination);
  }

  @Post('get-or-create')
  @ResponseMessage('Categoría lista')
  @ApiOperation({
    summary: 'Get existing category or create (normalized name)',
  })
  getOrCreate(
    @CurrentUserId() userId: string,
    @Body() dto: GetOrCreateCategoryDto,
  ) {
    return this.categoriesService.getOrCreate(userId, dto);
  }

  @Get(':id')
  @ResponseMessage('OK')
  @ApiOperation({ summary: 'Get category by id' })
  findOne(
    @CurrentUserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.categoriesService.findOne(userId, id);
  }

  @Patch(':id')
  @ResponseMessage('Categoría actualizada correctamente')
  @ApiOperation({ summary: 'Update category' })
  update(
    @CurrentUserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.categoriesService.update(userId, id, dto);
  }
}
