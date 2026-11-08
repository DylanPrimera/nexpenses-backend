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
import { INCOME_AMOUNT_MAX, INCOME_BANK_MAX } from './business-income.dto.js';
import { Trim } from './trim.js';

export const EXPENSE_TITLE_MAX = 80;
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class CreateBusinessExpenseDto {
  @ApiProperty({
    format: 'uuid',
    description:
      'Client-generated id (UUID v4); retries with the same id are idempotent',
  })
  @IsUUID('4')
  id: string;

  @ApiProperty({
    example: 'Materiales',
    minLength: 1,
    maxLength: EXPENSE_TITLE_MAX,
  })
  @Trim()
  @IsString()
  @MinLength(1)
  @MaxLength(EXPENSE_TITLE_MAX)
  title: string;

  @ApiProperty({ example: 30000, minimum: 1, maximum: INCOME_AMOUNT_MAX })
  @IsInt()
  @Min(1)
  @Max(INCOME_AMOUNT_MAX)
  amount: number;

  @ApiProperty({
    example: '2026-11-05',
    description: 'Spending day YYYY-MM-DD (America/Bogota), today or earlier',
  })
  @Matches(DAY_PATTERN, { message: 'spentOn must be YYYY-MM-DD' })
  spentOn: string;

  @ApiProperty({ enum: BusinessPaymentMethod })
  @IsEnum(BusinessPaymentMethod)
  paymentMethod: BusinessPaymentMethod;

  @ApiPropertyOptional({
    maxLength: INCOME_BANK_MAX,
    description: 'Only for transfers',
  })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(INCOME_BANK_MAX)
  bankName?: string;

  @ApiPropertyOptional({
    default: false,
    description:
      'Also record it as a personal expense in the business category',
  })
  @IsOptional()
  @IsBoolean()
  discountFromPersonal?: boolean;
}

export class UpdateBusinessExpenseDto {
  @ApiPropertyOptional({ minLength: 1, maxLength: EXPENSE_TITLE_MAX })
  @ValidateIf((_, value) => value !== undefined)
  @Trim()
  @IsString()
  @MinLength(1)
  @MaxLength(EXPENSE_TITLE_MAX)
  title?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: INCOME_AMOUNT_MAX })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(INCOME_AMOUNT_MAX)
  amount?: number;

  @ApiPropertyOptional({ example: '2026-11-05' })
  @IsOptional()
  @Matches(DAY_PATTERN, { message: 'spentOn must be YYYY-MM-DD' })
  spentOn?: string;

  @ApiPropertyOptional({ enum: BusinessPaymentMethod })
  @IsOptional()
  @IsEnum(BusinessPaymentMethod)
  paymentMethod?: BusinessPaymentMethod;

  @ApiPropertyOptional({
    nullable: true,
    maxLength: INCOME_BANK_MAX,
    description: 'Omit to keep it; null or blank clears it',
  })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(INCOME_BANK_MAX)
  bankName?: string | null;

  @ApiPropertyOptional({
    description: 'true links (or keeps) the personal expense; false removes it',
  })
  @IsOptional()
  @IsBoolean()
  discountFromPersonal?: boolean;
}
