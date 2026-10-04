import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class MigrateDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  userId: string;

  @ApiPropertyOptional({ description: 'Google ID token. Omit when using password.' })
  @IsOptional()
  @IsString()
  @MinLength(20)
  idToken?: string;

  @ApiPropertyOptional({ example: 'Ana' })
  @ValidateIf((dto: MigrateDto) => !dto.idToken)
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  @Matches(/^\S+$/)
  firstName?: string;

  @ApiPropertyOptional({ example: 'Pérez' })
  @ValidateIf((dto: MigrateDto) => !dto.idToken)
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  lastName?: string;

  @ApiPropertyOptional({ example: 'ana@example.com' })
  @ValidateIf((dto: MigrateDto) => !dto.idToken)
  @IsEmail()
  @MaxLength(320)
  email?: string;

  @ApiPropertyOptional()
  @ValidateIf((dto: MigrateDto) => !dto.idToken)
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password?: string;
}
