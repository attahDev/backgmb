import { IsObject, IsOptional, IsString } from 'class-validator';

/** Body for POST /activity/internal/log, called by the FastAPI tools
 *  (Market Research, Pitch Deck Builder, Proposal Builder) after a
 *  successful generation — not by user-facing clients. */
export class LogInternalActivityDto {
  @IsString()
  userId: string;

  @IsString()
  type: string;

  @IsString()
  message: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
