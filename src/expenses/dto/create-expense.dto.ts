import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { PaymentType } from '@prisma/client';

export class CreateExpenseDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  id?: string;

  @ApiProperty({ example: 25000, minimum: 1, maximum: 100_000_000 })
  @IsInt()
  @Min(1)
  @Max(100_000_000)
  amount: number;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  categoryId: string;

  @ApiProperty({ example: 'Lunch', minLength: 1, maxLength: 80 })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  title: string;

  @ApiProperty({ example: 'Bandeja paisa', minLength: 1, maxLength: 100 })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  description: string;

  @ApiPropertyOptional({
    enum: PaymentType,
    default: PaymentType.debit_card,
    example: PaymentType.debit_card,
  })
  @IsOptional()
  @IsEnum(PaymentType)
  paymentType?: PaymentType = PaymentType.debit_card;

  @ApiPropertyOptional({
    example: '2026-09-25T18:00:00.000Z',
    description: 'ISO datetime; defaults to now',
  })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional({
    description:
      'When set, the expense payment decreases that credit remainingBalance (floor 0)',
  })
  @IsOptional()
  @IsUUID()
  creditId?: string;

  @ApiPropertyOptional({
    description:
      'For CONSUMO credits, increment installmentCurrent when this payment is recorded',
  })
  @IsOptional()
  @IsBoolean()
  advanceInstallment?: boolean;

  @ApiPropertyOptional({
    description:
      'Also save amount, category, payment method, title, and description as a reusable recurring template. Ignored for credit installments.',
  })
  @IsOptional()
  @IsBoolean()
  saveAsRecurring?: boolean;
}
