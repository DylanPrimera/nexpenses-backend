import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CreditKind } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

function emptyToUndefined(value: unknown): unknown {
  if (typeof value === 'string' && value.trim() === '') return undefined;
  return value;
}

export class FromStatementDto {
  @ApiProperty({ enum: CreditKind, example: CreditKind.TC })
  @IsEnum(CreditKind)
  kind: CreditKind;

  @ApiPropertyOptional({ maxLength: 80 })
  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  displayName?: string;

  @ApiPropertyOptional({ maxLength: 80 })
  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  bankName?: string;

  @ApiPropertyOptional({
    description: 'Si se envía, reemplaza la tasa E.A. leída del PDF',
  })
  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(300)
  rateEa?: number;

  @ApiPropertyOptional({
    description: 'Si se envía, reemplaza la tasa M.V. leída del PDF',
  })
  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(300)
  rateMv?: number;
}
