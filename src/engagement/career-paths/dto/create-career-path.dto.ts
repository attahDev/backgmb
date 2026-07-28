import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

class RequiredSkillInput {
  @IsString()
  skillName: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  weight?: number;
}

export class CreateCareerPathDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RequiredSkillInput)
  requiredSkills: RequiredSkillInput[];
}
