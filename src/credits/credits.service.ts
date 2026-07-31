import { Injectable, Logger } from '@nestjs/common';
import { SubscriptionTier, SubscriptionStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

/** Matches the rank order of the SubscriptionTier enum in schema.prisma.
 *  "Min tier" checks (per the tool registry in the pricing doc) are a floor,
 *  not an explicit per-tool allow-list, so this stays a single ordered
 *  array rather than one ENTITLED_PLANS set per tool. */
const TIER_RANK: Record<SubscriptionTier, number> = {
  [SubscriptionTier.EXPLORER]: 0,
  [SubscriptionTier.STUDENT]: 1,
  [SubscriptionTier.PROFESSIONAL]: 2,
  [SubscriptionTier.FOUNDER]: 3,
  [SubscriptionTier.EXECUTIVE]: 4,
  [SubscriptionTier.TEAM]: 5,
  [SubscriptionTier.ENTERPRISE]: 6,
};

/** Default monthly allowance per tier — used only when a user has no
 *  Subscription row yet (implicit Explorer) or when granting a fresh one.
 *  Kept here rather than duplicated at every call site. Team's 1,500 is a
 *  shared-pool number and doesn't actually fit this per-user model yet —
 *  see the flag in gmbte-pricing memory; Team accounts default to Executive's
 *  per-seat number until that's designed properly. */
const DEFAULT_MONTHLY_ALLOWANCE: Record<SubscriptionTier, number> = {
  [SubscriptionTier.EXPLORER]: 10,
  [SubscriptionTier.STUDENT]: 50,
  [SubscriptionTier.PROFESSIONAL]: 150,
  [SubscriptionTier.FOUNDER]: 250,
  [SubscriptionTier.EXECUTIVE]: 1000,
  [SubscriptionTier.TEAM]: 1000, // placeholder — shared pool not yet modeled
  [SubscriptionTier.ENTERPRISE]: 1000, // placeholder — custom per contract
};

export class EntitlementError extends Error {}
export class InsufficientCreditsError extends Error {}

export interface CreditReservation {
  referenceId: string;
  userId: string;
  service: string;
  cost: number;
}

@Injectable()
export class CreditsService {
  private readonly logger = new Logger(CreditsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** For the frontend's proactive balance check — e.g. Academy course cards
   *  showing "Enroll (80 credits)" before the user taps anything, or the
   *  pay-confirmation screen the doc calls for. Creates the implicit
   *  EXPLORER subscription/balance on first touch, same as reserve() does,
   *  so a brand-new user gets a real number back instead of an error. */
  async getBalance(userId: string): Promise<{
    balance: number;
    tier: SubscriptionTier;
    monthlyAllowance: number;
  }> {
    const sub = await this.getOrCreateSubscription(userId);
    const credits = await this.getOrCreateCredits(userId, sub.monthlyAllowance);
    return {
      balance: credits.creditsBalance,
      tier: sub.tier,
      monthlyAllowance: sub.monthlyAllowance,
    };
  }

  /** Earning credits, not spending them — e.g. the Green Impact eco-point
   *  exchange. No entitlement/tier check (anyone can earn), no reserve step
   *  (there's nothing to fail-closed against), just a balance increment plus
   *  an append-only ledger row so it shows in the same audit trail as every
   *  spend. Returns the new balance. */
  async grant(
    userId: string,
    service: string,
    amount: number,
  ): Promise<number> {
    const sub = await this.getOrCreateSubscription(userId);
    await this.getOrCreateCredits(userId, sub.monthlyAllowance);

    const updated = await this.prisma.userCredits.update({
      where: { userId },
      data: { creditsBalance: { increment: amount } },
    });

    await this.prisma.aiCreditTransaction.create({
      data: {
        userId,
        service,
        referenceId: randomUUID(),
        amount,
        type: 'grant',
        balanceAfter: updated.creditsBalance,
      },
    });

    return updated.creditsBalance;
  }

  /** Gate 1 — static-ish check (one cheap read, no external call). Every
   *  user implicitly has an EXPLORER/MANUAL subscription if no row exists
   *  yet, matching "Explorer: free, no signup step beyond auth" from the
   *  pricing tiers. */
  async checkEntitlement(
    userId: string,
    minTier: SubscriptionTier,
  ): Promise<void> {
    const sub = await this.getOrCreateSubscription(userId);
    if (TIER_RANK[sub.tier] < TIER_RANK[minTier]) {
      throw new EntitlementError(
        `This feature requires ${minTier} tier or above (current: ${sub.tier}).`,
      );
    }
  }

  private async getOrCreateSubscription(userId: string) {
    const existing = await this.prisma.subscription.findUnique({
      where: { userId },
    });
    if (existing) return existing;

    return this.prisma.subscription.create({
      data: {
        userId,
        tier: SubscriptionTier.EXPLORER,
        status: SubscriptionStatus.MANUAL,
        monthlyAllowance: DEFAULT_MONTHLY_ALLOWANCE[SubscriptionTier.EXPLORER],
      },
    });
  }

  private async getOrCreateCredits(userId: string, allowance: number) {
    const existing = await this.prisma.userCredits.findUnique({
      where: { userId },
    });
    if (existing) return existing;

    return this.prisma.userCredits.create({
      data: { userId, creditsBalance: allowance, creditsResetAt: null },
    });
  }

  /** Gate 2 — atomic conditional decrement, fails closed on any DB error
   *  (mirrors the Python services' fail-closed reserve). Writes an append-only
   *  'reserve' row to ai_credit_transactions. */
  async reserve(
    userId: string,
    service: string,
    cost: number,
  ): Promise<CreditReservation> {
    const sub = await this.getOrCreateSubscription(userId);
    await this.getOrCreateCredits(userId, sub.monthlyAllowance);

    const referenceId = randomUUID();

    const result = await this.prisma.userCredits.updateMany({
      where: { userId, creditsBalance: { gte: cost } },
      data: { creditsBalance: { decrement: cost } },
    });

    if (result.count === 0) {
      throw new InsufficientCreditsError(
        `Insufficient credits: ${cost} required for ${service}.`,
      );
    }

    const updated = await this.prisma.userCredits.findUnique({
      where: { userId },
    });
    await this.prisma.aiCreditTransaction.create({
      data: {
        userId,
        service,
        referenceId,
        amount: -cost,
        type: 'reserve',
        balanceAfter: updated?.creditsBalance ?? null,
      },
    });

    return { referenceId, userId, service, cost };
  }

  /** Ledger-only — balance was already deducted at reserve time. Non-fatal
   *  on failure: the AI call already succeeded, so we log for manual
   *  reconciliation rather than fail the response over it. */
  async commit(reservation: CreditReservation): Promise<void> {
    try {
      await this.prisma.aiCreditTransaction.create({
        data: {
          userId: reservation.userId,
          service: reservation.service,
          referenceId: reservation.referenceId,
          amount: 0,
          type: 'commit',
        },
      });
    } catch (e) {
      this.logger.error(
        `Credit commit failed to record (job succeeded regardless) user=${reservation.userId} ref=${reservation.referenceId}: ${e}`,
      );
    }
  }

  /** Refund a reservation when the handler throws after credits were
   *  already taken. */
  async refund(reservation: CreditReservation): Promise<void> {
    try {
      const updated = await this.prisma.userCredits.update({
        where: { userId: reservation.userId },
        data: { creditsBalance: { increment: reservation.cost } },
      });
      await this.prisma.aiCreditTransaction.create({
        data: {
          userId: reservation.userId,
          service: reservation.service,
          referenceId: reservation.referenceId,
          amount: reservation.cost,
          type: 'refund',
          balanceAfter: updated.creditsBalance,
        },
      });
    } catch (e) {
      this.logger.error(
        `Credit refund failed user=${reservation.userId} ref=${reservation.referenceId}: ${e}`,
      );
    }
  }
}
