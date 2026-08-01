import { Injectable, BadRequestException } from '@nestjs/common';
import Stripe from 'stripe';
import { SubscriptionTier, SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

// Matches DEFAULT_MONTHLY_ALLOWANCE in credits.service.ts — kept in sync there.
const MONTHLY_ALLOWANCE: Record<SubscriptionTier, number> = {
  EXPLORER: 10,
  STUDENT: 50,
  PROFESSIONAL: 150,
  FOUNDER: 250,
  EXECUTIVE: 1000,
  TEAM: 1000,
  ENTERPRISE: 1000,
};

// One Stripe Price per tier x cycle, created in the Stripe dashboard.
const PRICE_IDS: Record<string, string | undefined> = {
  STUDENT_monthly: process.env.STRIPE_PRICE_STUDENT_MONTHLY,
  STUDENT_annual: process.env.STRIPE_PRICE_STUDENT_ANNUAL,
  PROFESSIONAL_monthly: process.env.STRIPE_PRICE_PROFESSIONAL_MONTHLY,
  PROFESSIONAL_annual: process.env.STRIPE_PRICE_PROFESSIONAL_ANNUAL,
  FOUNDER_monthly: process.env.STRIPE_PRICE_FOUNDER_MONTHLY,
  FOUNDER_annual: process.env.STRIPE_PRICE_FOUNDER_ANNUAL,
  EXECUTIVE_monthly: process.env.STRIPE_PRICE_EXECUTIVE_MONTHLY,
  EXECUTIVE_annual: process.env.STRIPE_PRICE_EXECUTIVE_ANNUAL,
};

@Injectable()
export class SubscriptionsService {
  private stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

  constructor(private readonly prisma: PrismaService) {}

  async createCheckoutSession(
    userId: string,
    email: string,
    tier: SubscriptionTier,
    billingCycle: 'monthly' | 'annual',
  ) {
    const priceId = PRICE_IDS[`${tier}_${billingCycle}`];
    if (!priceId) {
      throw new BadRequestException('No price configured for that tier/cycle');
    }

    const existing = await this.prisma.subscription.findUnique({ where: { userId } });

    // Reuse the Stripe customer if this user already has one (e.g. they
    // downgraded back to EXPLORER earlier but the Stripe customer still exists).
    let customerId = existing?.stripeCustomerId ?? undefined;
    if (!customerId) {
      const customer = await this.stripe.customers.create({ email, metadata: { userId } });
      customerId = customer.id;
    }

    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.FRONTEND_URL}/settings/billing?upgraded=1`,
      cancel_url: `${process.env.FRONTEND_URL}/settings/billing?canceled=1`,
      metadata: { userId, tier },
    });

    return { url: session.url };
  }

  /** Called from the webhook controller with the signature-verified Stripe event. */
  async handleEvent(event: Stripe.Event) {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        const tier = session.metadata?.tier as SubscriptionTier | undefined;
        if (!userId || !tier) return;

        const allowance = MONTHLY_ALLOWANCE[tier];

        await this.prisma.subscription.upsert({
          where: { userId },
          update: {
            tier,
            status: SubscriptionStatus.ACTIVE,
            monthlyAllowance: allowance,
            stripeCustomerId: session.customer as string,
            stripeSubscriptionId: session.subscription as string,
          },
          create: {
            userId,
            tier,
            status: SubscriptionStatus.ACTIVE,
            monthlyAllowance: allowance,
            stripeCustomerId: session.customer as string,
            stripeSubscriptionId: session.subscription as string,
          },
        });

        // Top up the wallet to the new tier's allowance on upgrade.
        await this.prisma.userCredits.upsert({
          where: { userId },
          update: { creditsBalance: allowance },
          create: { userId, creditsBalance: allowance },
        });
        break;
      }

      case 'customer.subscription.deleted': {
        const stripeSub = event.data.object as Stripe.Subscription;
        await this.prisma.subscription.updateMany({
          where: { stripeSubscriptionId: stripeSub.id },
          data: { tier: SubscriptionTier.EXPLORER, status: SubscriptionStatus.CANCELED },
        });
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        await this.prisma.subscription.updateMany({
          where: { stripeSubscriptionId: invoice.subscription as string },
          data: { status: SubscriptionStatus.PAST_DUE },
        });
        break;
      }
    }
  }

  /** MANUAL grant — for live testing/support, no Stripe involved. Mirrors the
   *  same upsert the checkout webhook does, just triggered by an admin
   *  instead of a completed payment. Lets the whole entitlement/reserve/
   *  commit/refund flow be exercised on the live site before Stripe is wired
   *  up for real checkout. */
  async grantManualTier(userId: string, tier: SubscriptionTier) {
    const allowance = MONTHLY_ALLOWANCE[tier];

    await this.prisma.subscription.upsert({
      where: { userId },
      update: { tier, status: SubscriptionStatus.MANUAL, monthlyAllowance: allowance },
      create: { userId, tier, status: SubscriptionStatus.MANUAL, monthlyAllowance: allowance },
    });

    return this.prisma.userCredits.upsert({
      where: { userId },
      update: { creditsBalance: allowance },
      create: { userId, creditsBalance: allowance },
    });
  }

  /** For the admin test panel — look up any user's current tier + balance
   *  (GET /subscriptions/me only ever returns the caller's own). */
  async getForUser(userId: string) {
    const sub = await this.prisma.subscription.findUnique({ where: { userId } });
    const credits = await this.prisma.userCredits.findUnique({ where: { userId } });
    return {
      tier: sub?.tier ?? SubscriptionTier.EXPLORER,
      status: sub?.status ?? SubscriptionStatus.MANUAL,
      creditsBalance: credits?.creditsBalance ?? null,
    };
  }

  verifyAndConstructEvent(rawBody: Buffer, signature: string): Stripe.Event {
    return this.stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  }
}
