import { IsEnum, IsUUID } from 'class-validator';
import { SubscriptionTier } from '@prisma/client';

export class GrantTierDto {
  @IsUUID()
  userId: string;

  @IsEnum(SubscriptionTier)
  tier: SubscriptionTier;
}
