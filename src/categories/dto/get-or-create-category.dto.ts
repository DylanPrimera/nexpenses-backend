import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class GetOrCreateCategoryDto {
  @ApiProperty({ example: 'Food', description: 'Will be normalized to lowercase' })
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  name: string;
}
