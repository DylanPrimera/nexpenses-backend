import { ApiPropertyOptional } from '@nestjs/swagger';
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
  ValidateIf,
} from 'class-validator';
import { PaymentType } from '@prisma/client';

export class UpdateExpenseDto {
  @ApiPropertyOptional({ example: 30000, minimum: 1, maximum: 100_000_000 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100_000_000)
  amount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ maxLength: 80 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  title?: string;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  description?: string;

  @ApiPropertyOptional({ enum: PaymentType })
  @IsOptional()
  @IsEnum(PaymentType)
  paymentType?: PaymentType;

  @ApiPropertyOptional({ example: '2026-09-25T18:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Link, move, or clear the credit this expense pays',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  creditId?: string | null;

  @ApiPropertyOptional({
    description:
      'For CONSUMO credits, increment installmentCurrent when newly linking this payment',
  })
  @IsOptional()
  @IsBoolean()
  advanceInstallment?: boolean;
}
