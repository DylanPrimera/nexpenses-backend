import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BusinessPaymentMethod } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { Trim } from './trim.js';

export const INCOME_TITLE_MAX = 120;
export const INCOME_DESCRIPTION_MAX = 1000;
export const INCOME_CLIENT_MAX = 120;
export const INCOME_BANK_MAX = 60;
export const INCOME_AMOUNT_MAX = 100_000_000;

export class CreateBusinessIncomeDto {
  @ApiProperty({ format: 'uuid', description: 'Client-generated id (UUID v4); retries with the same id are idempotent' })
  @IsUUID('4')
  id: string;

  @ApiProperty({ example: 'Diseño de logo', minLength: 1, maxLength: INCOME_TITLE_MAX })
  @Trim()
  @IsString()
  @MinLength(1)
  @MaxLength(INCOME_TITLE_MAX)
  title: string;

  @ApiPropertyOptional({ maxLength: INCOME_DESCRIPTION_MAX })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(INCOME_DESCRIPTION_MAX)
  description?: string;

  @ApiPropertyOptional({ maxLength: INCOME_CLIENT_MAX })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(INCOME_CLIENT_MAX)
  clientName?: string;

  @ApiProperty({ example: 20000, minimum: 1, maximum: INCOME_AMOUNT_MAX })
  @IsInt()
  @Min(1)
  @Max(INCOME_AMOUNT_MAX)
  amount: number;

  @ApiProperty({ example: '2026-11-07', description: 'Collection day YYYY-MM-DD (America/Bogota), today or earlier' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'collectedOn must be YYYY-MM-DD' })
  collectedOn: string;

  @ApiProperty({ enum: BusinessPaymentMethod })
  @IsEnum(BusinessPaymentMethod)
  paymentMethod: BusinessPaymentMethod;

  @ApiPropertyOptional({ maxLength: INCOME_BANK_MAX, description: 'Only for transfers' })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(INCOME_BANK_MAX)
  bankName?: string;

  @ApiPropertyOptional({ default: false, description: 'Also add the amount to the current personal budget cycle' })
  @IsOptional()
  @IsBoolean()
  addToPersonal?: boolean;
}

export class UpdateBusinessIncomeDto {
  @ApiPropertyOptional({ minLength: 1, maxLength: INCOME_TITLE_MAX })
  @ValidateIf((_, value) => value !== undefined)
  @Trim()
  @IsString()
  @MinLength(1)
  @MaxLength(INCOME_TITLE_MAX)
  title?: string;

  @ApiPropertyOptional({ nullable: true, maxLength: INCOME_DESCRIPTION_MAX })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(INCOME_DESCRIPTION_MAX)
  description?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: INCOME_CLIENT_MAX })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(INCOME_CLIENT_MAX)
  clientName?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  addToPersonal?: boolean;
}
