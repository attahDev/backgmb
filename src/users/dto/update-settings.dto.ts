import { IsEnum, IsOptional } from 'class-validator';
import { ProfileVisibility } from '@prisma/client';

export class UpdateSettingsDto {
  @IsOptional()
  @IsEnum(ProfileVisibility)
  profileVisibility?: ProfileVisibility;
}
