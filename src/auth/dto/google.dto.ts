import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class GoogleDto {
  @ApiProperty({ description: 'Google Identity Services ID token (credential)' })
  @IsString()
  @MinLength(20)
  idToken: string;
}
