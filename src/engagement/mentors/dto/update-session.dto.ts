import { IsDateString, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { SessionStatus } from '@prisma/client';

export class UpdateSessionDto {
  @IsOptional()
  @IsEnum(SessionStatus)
  status?: SessionStatus;

  // Set by the mentor when confirming — may differ from the mentee's proposedFor.
  @IsOptional()
  @IsDateString()
  scheduledFor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  mentorNotes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  menteeNotes?: string;
}
