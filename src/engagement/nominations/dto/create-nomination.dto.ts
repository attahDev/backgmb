import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateNominationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  nomineeName: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(3000)
  story: string;
}
