import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class SendMenteeMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  content: string;
}
