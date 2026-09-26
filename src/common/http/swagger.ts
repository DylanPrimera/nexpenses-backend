import { Type, applyDecorators } from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiExtraModels,
  ApiOkResponse,
  ApiProperty,
  ApiPropertyOptional,
  getSchemaPath,
} from '@nestjs/swagger';

export class ApiFieldErrorDetailDto {
  @ApiProperty({ example: 'name' })
  field!: string;

  @ApiProperty({ example: 'name must be longer than or equal to 1 characters' })
  message!: string;
}

export class ApiErrorBodyDto {
  @ApiProperty({ example: 400 })
  statusCode!: number;

  @ApiProperty({
    example: 'VALIDATION_ERROR',
    description:
      'VALIDATION_ERROR | NOT_FOUND | CONFLICT | UNAUTHORIZED | FORBIDDEN | RATE_LIMIT | BAD_REQUEST | INTERNAL_ERROR',
  })
  code!: string;

  @ApiPropertyOptional({ type: () => [ApiFieldErrorDetailDto] })
  details?: ApiFieldErrorDetailDto[];
}

export class ApiFailureResponseDto {
  @ApiProperty({ example: false })
  success!: false;

  @ApiProperty({ nullable: true, type: Object, example: null })
  data!: null;

  @ApiProperty({ example: 'Error de validación' })
  message!: string;

  @ApiProperty({ type: () => ApiErrorBodyDto })
  error!: ApiErrorBodyDto;
}

export class PaginatedMetaDto {
  @ApiProperty({ type: 'array', items: { type: 'object' } })
  items!: unknown[];

  @ApiProperty({ example: 42 })
  total!: number;

  @ApiProperty({ example: 50 })
  limit!: number;

  @ApiProperty({ example: 0 })
  offset!: number;
}

export function ApiWrappedOkResponse<TModel extends Type<unknown>>(
  dataType: TModel,
  options?: { description?: string; isArray?: boolean; message?: string },
) {
  const message = options?.message ?? 'OK';
  const dataSchema = options?.isArray
    ? { type: 'array' as const, items: { $ref: getSchemaPath(dataType) } }
    : { $ref: getSchemaPath(dataType) };

  return applyDecorators(
    ApiExtraModels(dataType),
    ApiOkResponse({
      description: options?.description ?? 'Successful response',
      schema: {
        type: 'object',
        required: ['success', 'data', 'message'],
        properties: {
          success: { type: 'boolean', example: true },
          data: dataSchema,
          message: { type: 'string', example: message },
        },
      },
    }),
  );
}

export function ApiWrappedCreatedResponse<TModel extends Type<unknown>>(
  dataType: TModel,
  options?: { description?: string; message?: string },
) {
  const message = options?.message ?? 'Creado correctamente';
  return applyDecorators(
    ApiExtraModels(dataType),
    ApiCreatedResponse({
      description: options?.description ?? 'Resource created',
      schema: {
        type: 'object',
        required: ['success', 'data', 'message'],
        properties: {
          success: { type: 'boolean', example: true },
          data: { $ref: getSchemaPath(dataType) },
          message: { type: 'string', example: message },
        },
      },
    }),
  );
}

export function ApiWrappedPaginatedOkResponse<TModel extends Type<unknown>>(
  itemType: TModel,
  options?: { description?: string; message?: string },
) {
  const message = options?.message ?? 'OK';
  return applyDecorators(
    ApiExtraModels(itemType),
    ApiOkResponse({
      description: options?.description ?? 'Paginated list',
      schema: {
        type: 'object',
        required: ['success', 'data', 'message'],
        properties: {
          success: { type: 'boolean', example: true },
          data: {
            type: 'object',
            required: ['items', 'total', 'limit', 'offset'],
            properties: {
              items: {
                type: 'array',
                items: { $ref: getSchemaPath(itemType) },
              },
              total: { type: 'number', example: 42 },
              limit: { type: 'number', example: 50 },
              offset: { type: 'number', example: 0 },
            },
          },
          message: { type: 'string', example: message },
        },
      },
    }),
  );
}
