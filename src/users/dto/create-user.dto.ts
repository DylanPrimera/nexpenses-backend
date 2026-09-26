import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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

/** Matches frontend budgetSetupSchema: first name, 1–20, no spaces. */
const FIRST_NAME_MAX = 20;

export class CreateUserDto {
  @ApiProperty({
    example: 'Dylan',
    minLength: 1,
    maxLength: FIRST_NAME_MAX,
    description: 'First name only (no spaces), max 20 — matches FE budgetSetupSchema',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(FIRST_NAME_MAX)
  @Matches(/^\S+$/, { message: 'name must not contain spaces' })
  name: string;

  @ApiProperty({
    example: 2000000,
    description: 'Monthly budget in COP integers',
    minimum: 10_000,
    maximum: 100_000_000,
  })
  @IsInt()
  @Min(10_000)
  @Max(100_000_000)
  budget: number;

  @ApiPropertyOptional({
    example: 'dylan@example.com',
    description: 'Optional contact email; unique when set',
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== '')
  @IsEmail()
  @MaxLength(320)
  email?: string | null;

  @ApiPropertyOptional({
    example: 'opaque-app-token',
    description:
      'Optional email-app / integration token. Sensitive — stored, never logged.',
    nullable: true,
    maxLength: 512,
  })
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== '')
  @IsString()
  @MaxLength(512)
  emailAppToken?: string | null;
}
