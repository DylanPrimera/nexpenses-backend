import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
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
}
