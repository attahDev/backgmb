import { IsNumber, IsOptional, Min } from 'class-validator';

export class Co2CalculatorDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  transportKm?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  energyKwh?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  wasteKg?: number;
}
