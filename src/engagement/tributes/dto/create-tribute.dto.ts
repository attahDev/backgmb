import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateTributeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  message: string;
}
