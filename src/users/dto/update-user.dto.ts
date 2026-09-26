import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

const FIRST_NAME_MAX = 20;

export class UpdateUserDto {
  @ApiPropertyOptional({
    example: 'Dylan',
    minLength: 1,
    maxLength: FIRST_NAME_MAX,
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(FIRST_NAME_MAX)
  @Matches(/^\S+$/, { message: 'name must not contain spaces' })
  name?: string;

  @ApiPropertyOptional({
    example: 3000000,
    minimum: 10_000,
    maximum: 100_000_000,
  })
  @IsOptional()
  @IsInt()
  @Min(10_000)
  @Max(100_000_000)
  budget?: number;

  @ApiPropertyOptional({
    example: 'dylan@example.com',
    nullable: true,
    description: 'Set to null or empty string to clear',
  })
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== '')
  @IsEmail()
  @MaxLength(320)
  email?: string | null;

  @ApiPropertyOptional({
    example: 'opaque-app-token',
    nullable: true,
    description:
      'Optional email-app token. Sensitive — stored, never logged. Null/empty clears.',
    maxLength: 512,
  })
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== '')
  @IsString()
  @MaxLength(512)
  emailAppToken?: string | null;
}
