import { SetMetadata } from '@nestjs/common';
import { SubscriptionTier } from '@prisma/client';

export const CREDIT_COST_KEY = 'creditCost';

export interface CreditCostMeta {
  /** Ledger `service` value — matches the Python microservices' SERVICE_NAME
   *  convention (e.g. 'mentor_ai', 'green_ai_advisor') so ai_credit_transactions
   *  reads the same across every service, NestJS or Python. */
  service: string;
  cost: number;
  minTier: SubscriptionTier;
  /** Set true when this route is paired with OptionalJwtAuthGuard rather
   *  than JwtAuthGuard (e.g. HOF AI, Chatbot — public pages with no login
   *  of their own). Anonymous requests (no user on the request) pass
   *  through free and ungated; only requests carrying a real, authenticated
   *  user get entitlement-checked and charged. Defaults to false, meaning
   *  CreditGuard still requires a user (its behavior for every other
   *  route using the mandatory JwtAuthGuard). */
  optional?: boolean;
}

/**
 * Usage:
 *   @UseGuards(JwtAuthGuard, CreditGuard)
 *   @UseInterceptors(CreditFinalizeInterceptor)
 *   @RequireCredits({ service: 'mentor_ai', cost: 7, minTier: SubscriptionTier.PROFESSIONAL })
 *   @Post('chat')
 *   chat(...) { ... }
 *
 * CreditGuard reads this metadata to check entitlement + reserve credits
 * before the handler runs; CreditFinalizeInterceptor reads request.creditReservation
 * (set by the guard) to commit or refund after the handler settles.
 */
export const RequireCredits = (meta: CreditCostMeta) =>
  SetMetadata(CREDIT_COST_KEY, meta);
