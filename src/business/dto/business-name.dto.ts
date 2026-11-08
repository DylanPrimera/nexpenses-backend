import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { Trim } from './trim.js';

export const BUSINESS_NAME_MAX = 80;

export class BusinessNameDto {
  @ApiProperty({ example: 'Estudio Primera', minLength: 1, maxLength: BUSINESS_NAME_MAX })
  @Trim()
  @IsString()
  @MinLength(1)
  @MaxLength(BUSINESS_NAME_MAX)
  name: string;
}
