import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export const GREEN_ACTION_TYPES = [
  'RECYCLING',
  'TRANSPORT',
  'ENERGY',
  'WASTE_REDUCTION',
  'TREE_PLANTING',
  'OTHER',
] as const;

export class LogGreenActionDto {
  @IsIn(GREEN_ACTION_TYPES)
  type: (typeof GREEN_ACTION_TYPES)[number];

  @IsOptional()
  @IsString()
  description?: string;

  // Sanity cap — 1000kg in a single log entry is already an extreme outlier
  // (roughly a transatlantic flight's worth), catches fat-finger entries
  // without needing a human review step for every submission.
  @IsNumber()
  @Min(0.01)
  @Max(1000)
  co2OffsetKg: number;

  // Optional Greater Manchester borough — powers the real "Impact by Area"
  // chart. Free text so the frontend's dropdown list can change without a
  // backend deploy.
  @IsOptional()
  @IsString()
  area?: string;
}
