import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class LogSkillDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  skillName: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsOptional()
  @IsString()
  sessionId?: string;
}
