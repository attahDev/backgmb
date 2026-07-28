import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class AddCareerPathSkillDto {
  @IsString()
  skillName: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  weight?: number;
}
