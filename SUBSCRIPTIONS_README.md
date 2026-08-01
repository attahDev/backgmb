# Subscription upgrade — setup notes

Files in this drop, relative to `backgmb/`:

- `src/subscriptions/` — new module (checkout + webhook)
- `src/app.module.ts` — modified, registers `SubscriptionsModule`
- `src/main.ts` — modified, adds `{ rawBody: true }` (required for Stripe webhook signature check)
- `package.json` — modified, adds the `stripe` dependency

## After extracting into your repo

```bash
npm install
```

## New env vars needed (Render dashboard, and local `.env`)

```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
FRONTEND_URL=https://frogmbte.vercel.app

STRIPE_PRICE_STUDENT_MONTHLY=price_...
STRIPE_PRICE_STUDENT_ANNUAL=price_...
STRIPE_PRICE_PROFESSIONAL_MONTHLY=price_...
STRIPE_PRICE_PROFESSIONAL_ANNUAL=price_...
STRIPE_PRICE_FOUNDER_MONTHLY=price_...
STRIPE_PRICE_FOUNDER_ANNUAL=price_...
STRIPE_PRICE_EXECUTIVE_MONTHLY=price_...
STRIPE_PRICE_EXECUTIVE_ANNUAL=price_...
```

Each `STRIPE_PRICE_*` is a Price ID created in the Stripe dashboard (one per tier per billing cycle).

## Stripe dashboard webhook

Point a webhook endpoint at `https://backgmb.onrender.com/subscriptions/webhook`, subscribed to:
- `checkout.session.completed`
- `customer.subscription.deleted`
- `invoice.payment_failed`

Copy the signing secret it gives you into `STRIPE_WEBHOOK_SECRET`.

## Testing the credits system live, before Stripe is wired up

None of `credits`/`subscriptions` depends on Stripe — only the checkout trigger does.
Two admin-only endpoints let you flip a real user between tiers on the live site instead:

- `POST /subscriptions/admin/grant` — body `{ userId, tier }`, sets `SubscriptionTier`
  + `SubscriptionStatus.MANUAL` and tops up `creditsBalance` to that tier's allowance.
  Same upsert the Stripe webhook will use later, just admin-triggered instead of
  payment-triggered.
- `GET /subscriptions/admin/:userId` — current tier + credit balance for any user.

Both are `@Roles(UserRole.ADMIN)`-gated. On the frontend, log in as an admin
(e.g. the seeded `superadmin@gmbt.dev`) and go to **Dashboard → Admin → Billing (test)**
to search a user, grant them a tier, and watch their balance update — then hit any
credit-gated route (mentor-ai, hof-ai, green-ai, chatbot, business-planner) as that
user to see entitlement checks and reserve/commit/refund happen for real.
