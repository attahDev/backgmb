import { IsDateString, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class RequestSessionDto {
  @IsDateString()
  proposedFor: string;

  @IsOptional()
  @IsInt()
  @Min(15)
  @Max(180)
  durationMins?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  agenda?: string;
}
