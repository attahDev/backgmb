import { IsArray, IsBoolean, IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { EventAudience } from '@prisma/client';

export class CreateEventDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsString()
  mode?: string;

  @IsOptional()
  @IsString()
  link?: string;

  @IsDateString()
  startsAt: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  // Which public Events page this shows on — gmbtefro (GENERAL, default)
  // or the Hall of Fame site (HALL_OF_FAME). See schema comment on
  // Event.audience.
  @IsOptional()
  @IsEnum(EventAudience)
  audience?: EventAudience;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
