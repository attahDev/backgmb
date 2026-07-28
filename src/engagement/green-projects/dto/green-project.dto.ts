import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class CreateGreenProjectDto {
  @IsString() @IsNotEmpty() title: string;
  @IsString() @IsNotEmpty() description: string;
  @IsOptional() @IsString() imageUrl?: string;

  // Stored in pence/cents to avoid float rounding on money — same reason
  // most billing systems avoid storing currency as a raw float.
  @IsInt() @Min(1) goalAmountMinor: number;

  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateGreenProjectDto {
  @IsOptional() @IsString() @IsNotEmpty() title?: string;
  @IsOptional() @IsString() @IsNotEmpty() description?: string;
  @IsOptional() @IsString() imageUrl?: string;
  @IsOptional() @IsInt() @Min(1) goalAmountMinor?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
