import { ApiPropertyOptional } from '@nestjs/swagger';
import { CreditKind } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationDto } from '../../common/dtos/pagination.dto.js';

export class FilterCreditsDto extends PaginationDto {
  @ApiPropertyOptional({ enum: CreditKind })
  @IsOptional()
  @IsEnum(CreditKind)
  kind?: CreditKind;
}
