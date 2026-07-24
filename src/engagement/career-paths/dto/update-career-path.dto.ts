import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateCareerPathDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
