import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({ example: 'food', minLength: 1, maxLength: 40 })
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  name: string;

  @ApiPropertyOptional({ example: '#10b981', description: 'Hex color; auto-assigned if omitted' })
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'color must be a hex like #10b981' })
  color?: string;
}
