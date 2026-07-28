import { IsString } from 'class-validator';

export class SetCareerGoalDto {
  @IsString()
  careerPathId: string;
}
