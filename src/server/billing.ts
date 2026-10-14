import "server-only";
import Stripe from "stripe";
import { db } from "@/server/db";
import { ActionError } from "@/server/action";
import type { Viewer } from "@/server/session";
import { notify } from "@/server/services/notifications";
import { k } from "@/i18n/message";
import { PRODUCTS, priorityApplicationCredits, type ProductCode } from "@/lib/billing/products";
import { absoluteUrl, formatMoney } from "@/lib/utils";
import { paddle } from "@/server/paddle";

// Payments go through Stripe Checkout: card details are entered on Stripe's
// hosted page and never reach JOBLIO. We store only Stripe object IDs.
//
// Modes:
//   stripe    STRIPE_SECRET_KEY is set
//   simulate  development only, PAYMENTS_DEV_SIMULATE=true — purchases are
//             fulfilled instantly so premium flows can be demoed end-to-end
//   disabled  otherwise

let stripeClient: Stripe | null = null;
export function stripe() {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  stripeClient ??= new Stripe(process.env.STRIPE_SECRET_KEY, { appInfo: { name: "JOBLIO" } });
  return stripeClient;
}

export function paymentsMode(): "stripe" | "simulate" | "disabled" {
  if (process.env.STRIPE_SECRET_KEY) return "stripe";
  if (process.env.NODE_ENV !== "production" && process.env.PAYMENTS_DEV_SIMULATE === "true") return "simulate";
  return "disabled";
}

export async function nextInvoiceNumber() {
  const year = new Date().getFullYear();
  const count = await db.payment.count({ where: { createdAt: { gte: new Date(year, 0, 1) } } });
  return `JBL-${year}-${String(count + 1).padStart(5, "0")}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

const addDays = (from: Date, days: number) => new Date(from.getTime() + days * 86_400_000);
const addMonth = (from: Date) => {
  const d = new Date(from);
  d.setMonth(d.getMonth() + 1);
  return d;
};

/** Checks that the viewer may buy this product (and owns its target). */
async function authorize(viewer: Viewer, code: ProductCode, targetId: string | null) {
  const product = PRODUCTS[code];
  if (product.audience !== "member" && !viewer.company) throw new ActionError("@msg.needWorkspaceProduct");
  if (product.audience === "company-admin" && !(viewer.company && (viewer.company.role === "OWNER" || viewer.company.role === "ADMIN"))) {
    throw new ActionError("@msg.adminsOnlyUpgrade");
  }
  if (product.needsTarget === "job") {
    if (!targetId) throw new ActionError("@msg.chooseJob");
    const job = await db.job.findFirst({ where: { id: targetId, companyId: viewer.company!.id, status: "OPEN" }, select: { id: true } });
    if (!job) throw new ActionError("@msg.openJobsOnly");
  }
  if (product.mode === "subscription") {
    const active = await db.subscription.findFirst({
      where: {
        product: code,
        status: { in: ["ACTIVE", "TRIALING", "PAST_DUE"] },
        currentPeriodEnd: { gt: new Date() },
        ...(code === "COMPANY_PREMIUM" ? { companyId: viewer.company!.id } : { userId: viewer.id }),
      },
    });
    if (active) throw new ActionError("@msg.alreadyHavePlan");
  }
}

async function ensureCustomer(viewer: Viewer) {
  const s = stripe()!;
  const user = await db.user.findUniqueOrThrow({ where: { id: viewer.id }, select: { stripeCustomerId: true, email: true, name: true } });
  if (user.stripeCustomerId) return user.stripeCustomerId;
  const customer = await s.customers.create({ email: user.email, name: user.name, metadata: { userId: viewer.id } });
  await db.user.update({ where: { id: viewer.id }, data: { stripeCustomerId: customer.id } });
  return customer.id;
}

/** Starts a purchase. Returns the URL to send the browser to. */
export async function startCheckout(viewer: Viewer, code: ProductCode, targetId: string | null) {
  const mode = paymentsMode();
  if (mode === "disabled") throw new ActionError("@msg.paymentsOff");
  await authorize(viewer, code, targetId);
  const product = PRODUCTS[code];

  const payment = await db.payment.create({
    data: {
      userId: viewer.id,
      companyId: product.audience === "member" ? null : viewer.company!.id,
      product: code,
      description: product.name,
      amount: product.amount,
      currency: product.currency,
      invoiceNumber: await nextInvoiceNumber(),
      targetId,
    },
  });

  if (mode === "simulate") {
    await fulfillPayment(payment.id, {});
    return absoluteUrl(`/settings/billing?success=${payment.id}`);
  }

  const s = stripe()!;
  const customer = await ensureCustomer(viewer);
  const metadata = { paymentId: payment.id, userId: viewer.id, product: code, targetId: targetId ?? "" };
  const session = await s.checkout.sessions.create({
    mode: product.mode,
    customer,
    client_reference_id: viewer.id,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: product.currency,
          unit_amount: product.amount,
          product_data: { name: product.name, description: product.tagline },
          ...(product.mode === "subscription" && { recurring: { interval: "month" as const } }),
        },
      },
    ],
    metadata,
    ...(product.mode === "subscription" ? { subscription_data: { metadata } } : { payment_intent_data: { metadata }, invoice_creation: { enabled: true } }),
    success_url: absoluteUrl(`/settings/billing?success=${payment.id}`),
    cancel_url: absoluteUrl(`/premium?canceled=1`),
  });
  await db.payment.update({ where: { id: payment.id }, data: { stripeCheckoutSessionId: session.id } });
  if (!session.url) throw new ActionError("@msg.checkoutFailed");
  return session.url;
}

/**
 * Grants what was purchased. Idempotent: safe to call from both the webhook
 * and any retry. Never trusts the browser — only the server or Stripe call it.
 */
export async function fulfillPayment(
  paymentId: string,
  stripeData: {
    paymentIntentId?: string | null;
    subscriptionId?: string | null;
    periodEnd?: Date | null;
    invoiceId?: string | null;
    receiptUrl?: string | null;
    /** Featured Job plan length (Paddle plans: 7/14/30). Defaults to the product duration. */
    days?: number | null;
    /** Priority Application credit count (1/5/10). Overrides the description parser. */
    credits?: number | null;
  },
) {
  const payment = await db.payment.findUnique({ where: { id: paymentId } });
  if (!payment || payment.status === "SUCCEEDED") return;
  const product = PRODUCTS[payment.product];
  const now = new Date();

  await db.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: "SUCCEEDED",
        paidAt: now,
        stripePaymentIntentId: stripeData.paymentIntentId ?? undefined,
        stripeInvoiceId: stripeData.invoiceId ?? undefined,
        receiptUrl: stripeData.receiptUrl ?? undefined,
      },
    });

    switch (payment.product) {
      case "CAREER_BOOST_7":
      case "CAREER_BOOST_30":
      case "PROFILE_BOOST": {
        const profile = await tx.profile.findUniqueOrThrow({ where: { userId: payment.userId }, select: { featuredUntil: true } });
        // Stack on top of an active boost instead of overlapping it.
        const start = profile.featuredUntil && profile.featuredUntil > now ? profile.featuredUntil : now;
        const endsAt = addDays(start, stripeData.days ?? product.days!);
        await tx.profileBoost.create({ data: { userId: payment.userId, product: payment.product, startsAt: start, endsAt, paymentId: payment.id } });
        await tx.profile.update({ where: { userId: payment.userId }, data: { featuredUntil: endsAt, openToWork: true } });
        break;
      }
      case "FEATURED_JOB":
      case "SPONSORED_JOB": {
        const job = await tx.job.findUniqueOrThrow({ where: { id: payment.targetId! }, select: { featuredUntil: true, sponsoredUntil: true } });
        const featured = payment.product === "FEATURED_JOB";
        const current = featured ? job.featuredUntil : job.sponsoredUntil;
        const start = current && current > now ? current : now;
        const endsAt = addDays(start, (featured && stripeData.days) || product.days!);
        await tx.jobPromotion.create({ data: { jobId: payment.targetId!, kind: featured ? "FEATURED" : "SPONSORED", startsAt: start, endsAt, paymentId: payment.id } });
        await tx.job.update({ where: { id: payment.targetId! }, data: featured ? { featuredUntil: endsAt } : { sponsoredUntil: endsAt } });
        break;
      }
      case "URGENT_HIRE": {
        const job = await tx.job.findUniqueOrThrow({ where: { id: payment.targetId! }, select: { urgentUntil: true } });
        const start = job.urgentUntil && job.urgentUntil > now ? job.urgentUntil : now;
        const endsAt = addDays(start, stripeData.days ?? product.days!);
        await tx.jobPromotion.create({ data: { jobId: payment.targetId!, kind: "URGENT", startsAt: start, endsAt, paymentId: payment.id } });
        await tx.job.update({ where: { id: payment.targetId! }, data: { urgentUntil: endsAt } });
        break;
      }
      case "PRIORITY_APPLICATION": {
        const credits = stripeData.credits ?? priorityApplicationCredits(payment) ?? 1;
        await tx.user.update({
          where: { id: payment.userId },
          data: { priorityCredits: { increment: credits } },
        });
        break;
      }
      case "PREMIUM_PORTFOLIO":
      case "RECRUITER_PRO":
      case "COMPANY_PREMIUM": {
        const periodEnd = stripeData.periodEnd ?? addMonth(now);
        const existing = stripeData.subscriptionId ? await tx.subscription.findUnique({ where: { paddleSubscriptionId: stripeData.subscriptionId } }) : null;
        if (existing) {
          await tx.subscription.update({ where: { id: existing.id }, data: { status: "ACTIVE", currentPeriodEnd: periodEnd } });
        } else {
          await tx.subscription.create({
            data: {
              userId: payment.userId,
              companyId: payment.companyId,
              product: payment.product,
              status: "ACTIVE",
              currentPeriodEnd: periodEnd,
              paddleSubscriptionId: stripeData.subscriptionId ?? null,
            },
          });
        }
        if (payment.product === "COMPANY_PREMIUM" && payment.companyId) await tx.company.update({ where: { id: payment.companyId }, data: { premiumUntil: periodEnd } });
        break;
      }
    }
  });

  await notify({
    userId: payment.userId,
    type: "BILLING",
    title: k("notif.payment", { product: `@premium.products.${payment.product}.name` }),
    body: k("notif.paymentBody", { amount: formatMoney(payment.amount, payment.currency), invoice: payment.invoiceNumber ?? "" }),
    href: "/settings/billing",
  });
}

export async function markPaymentFailed(paymentId: string) {
  await db.payment.updateMany({ where: { id: paymentId, status: "PENDING" }, data: { status: "FAILED" } });
}

// Paddle subscription IDs are "sub_" + a 26-character lowercase ULID; anything else in this
// (formerly Stripe) column is a legacy Stripe subscription.
const isPaddleSubscriptionId = (id: string) => /^sub_01[0-9a-z]{24}$/.test(id);

/** Cancels at period end (keeps access until then), or undoes a scheduled cancel. */
export async function setCancelAtPeriodEnd(viewer: Viewer, subscriptionId: string, cancel: boolean) {
  const sub = await db.subscription.findFirst({ where: { id: subscriptionId, userId: viewer.id } });
  if (!sub) throw new ActionError("@msg.subNotFound");
  const p = paddle();
  if (sub.paddleSubscriptionId && isPaddleSubscriptionId(sub.paddleSubscriptionId) && p) {
    // Paddle: POST /subscriptions/{id}/cancel schedules the cancel for the end of the billing period;
    // PATCH scheduled_change: null removes a scheduled cancel. The webhook confirms the new state.
    if (cancel) await p.subscriptions.cancel(sub.paddleSubscriptionId, { effectiveFrom: "next_billing_period" });
    else await p.subscriptions.update(sub.paddleSubscriptionId, { scheduledChange: null });
  } else if (sub.paddleSubscriptionId && stripe()) {
    // Legacy Stripe subscription (Stripe API).
    await stripe()!.subscriptions.update(sub.paddleSubscriptionId, { cancel_at_period_end: cancel });
  } else if (paymentsMode() === "disabled" && !p) {
    throw new ActionError("@msg.paymentsOff");
  }
  await db.subscription.update({ where: { id: sub.id }, data: { cancelAtPeriodEnd: cancel } });
}

/** Stripe-hosted page to update cards and download invoices. */
export async function billingPortalUrl(viewer: Viewer) {
  const s = stripe();
  if (!s) throw new ActionError("@msg.stripeOff");
  const customer = await ensureCustomer(viewer);
  const session = await s.billingPortal.sessions.create({ customer, return_url: absoluteUrl("/settings/billing") });
  return session.url;
}

/** Applies subscription lifecycle changes reported by Stripe. */
export async function syncStripeSubscription(sub: Stripe.Subscription) {
  const local = await db.subscription.findUnique({ where: { paddleSubscriptionId: sub.id } });
  if (!local) return;
  const periodEndUnix = sub.items.data[0]?.current_period_end;
  const STATUS: Record<string, "ACTIVE" | "TRIALING" | "PAST_DUE" | "CANCELED" | "INCOMPLETE"> = {
    active: "ACTIVE",
    trialing: "TRIALING",
    past_due: "PAST_DUE",
    canceled: "CANCELED",
    unpaid: "PAST_DUE",
    incomplete: "INCOMPLETE",
    incomplete_expired: "CANCELED",
    paused: "PAST_DUE",
  };
  const status = STATUS[sub.status] ?? "PAST_DUE";
  const periodEnd = periodEndUnix ? new Date(periodEndUnix * 1000) : local.currentPeriodEnd;
  await db.subscription.update({ where: { id: local.id }, data: { status, cancelAtPeriodEnd: sub.cancel_at_period_end, currentPeriodEnd: periodEnd } });
  if (local.product === "COMPANY_PREMIUM" && local.companyId) {
    await db.company.update({ where: { id: local.companyId }, data: { premiumUntil: status === "CANCELED" ? new Date() : periodEnd } });
  }
}
