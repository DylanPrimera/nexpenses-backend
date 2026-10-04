import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'Ana', maxLength: 20 })
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  @Matches(/^\S+$/)
  firstName: string;

  @ApiProperty({ example: 'Pérez', maxLength: 80 })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  lastName: string;

  @ApiProperty({ example: 'ana@example.com' })
  @IsEmail()
  @MaxLength(320)
  email: string;

  @ApiProperty({ minLength: 8, maxLength: 128 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;
}
