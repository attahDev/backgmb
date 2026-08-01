import { IsEnum, IsIn } from 'class-validator';
import { SubscriptionTier } from '@prisma/client';

const PAID_TIERS = [
  SubscriptionTier.STUDENT,
  SubscriptionTier.PROFESSIONAL,
  SubscriptionTier.FOUNDER,
  SubscriptionTier.EXECUTIVE,
] as const;

export class CreateCheckoutDto {
  @IsEnum(SubscriptionTier)
  @IsIn(PAID_TIERS, { message: 'tier must be a paid, self-serve tier' })
  tier: SubscriptionTier;

  @IsIn(['monthly', 'annual'])
  billingCycle: 'monthly' | 'annual';
}
