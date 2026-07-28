import { IsDateString, IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { MentorConnectionStatus } from '@prisma/client';

export class UpdateMenteeConnectionDto {
  @IsOptional()
  @IsEnum(MentorConnectionStatus)
  status?: MentorConnectionStatus;

  @IsOptional()
  @IsInt()
  @Min(0)
  sessionsCompleted?: number;

  @IsOptional()
  @IsDateString()
  nextSessionAt?: string;
}
