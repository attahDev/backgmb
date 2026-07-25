import { IsString, MinLength, MaxLength } from 'class-validator';

export class HofChatDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  message: string;
}
