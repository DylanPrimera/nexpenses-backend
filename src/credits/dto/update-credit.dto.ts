import { ApiPropertyOptional } from '@nestjs/swagger';
import { CreditKind, CreditProvider } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class UpdateCreditDto {
  @ApiPropertyOptional({ enum: CreditKind })
  @IsOptional()
  @IsEnum(CreditKind)
  kind?: CreditKind;

  @ApiPropertyOptional({ enum: CreditProvider })
  @IsOptional()
  @IsEnum(CreditProvider)
  provider?: CreditProvider;

  @ApiPropertyOptional({ maxLength: 80 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  bankName?: string;

  @ApiPropertyOptional({ maxLength: 80 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  displayName?: string;

  @ApiPropertyOptional({ maxLength: 64, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  productRef?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsDateString()
  cutoffDate?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  nextPaymentDate?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(5000)
  daysPastDue?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  remainingBalance?: number;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  periodInterest?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  insuranceOrOtherCharges?: number | null;

  @ApiPropertyOptional({
    description:
      'Tasa efectiva anual (%). Si se envía, se recalculan interés del periodo y, en consumo con plazo, el saldo proyectado.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(300)
  rateEa?: number | null;

  @ApiPropertyOptional({
    description:
      'Tasa mes vencido (%). Si se envía, se recalculan interés del periodo y, en consumo con plazo, el saldo proyectado.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(300)
  rateMv?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  creditLimit?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  availableCredit?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  usedAmount?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  minPayment?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amountDueThisPeriod?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  installmentAmount?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  installmentCurrent?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  installmentTotal?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  originalAmount?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(600)
  termMonths?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  installmentType?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  stage?: string | null;
}
