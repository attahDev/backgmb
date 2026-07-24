import { IsDateString, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateMentorSpotlightDto {
  @IsString()
  @IsNotEmpty()
  mentorId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  shoutout: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
