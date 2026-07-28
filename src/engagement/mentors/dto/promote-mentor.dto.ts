import { IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator';

/** Admin promotes an EXISTING user (they keep their own login) to mentor.
 *  This sets User.role = MENTOR and creates/links their Mentor profile row. */
export class PromoteMentorDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  /** Mentor-facing title, e.g. "Senior Frontend Engineer" — distinct from User.role. */
  @IsString()
  @IsNotEmpty()
  roleTitle: string;

  @IsOptional()
  @IsString()
  company?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skills?: string[];
}
