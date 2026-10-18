import "server-only";
import { db } from "@/server/db";
import { ActionError } from "@/server/action";
import type { Viewer } from "@/server/session";
import { notify } from "@/server/services/notifications";
import { k } from "@/i18n/message";
import { PAYMENTS_PAUSED, PRODUCTS, priorityApplicationCredits, type ProductCode } from "@/lib/billing/products";
import { absoluteUrl, formatMoney } from "@/lib/utils";
import { createPaddlePortalSession, paddle } from "@/server/paddle";

// Payments go through Paddle (src/server/paddle.ts): card details are entered in Paddle's
// checkout and never reach JOBLIO. This module grants purchases and manages subscriptions.
//
// Modes:
//   paddle    PADDLE_API_KEY is set
//   simulate  development only — legacy purchases (startCheckout) are fulfilled
//             instantly so premium flows can be demoed end-to-end
//   disabled  otherwise

export function paymentsMode(): "paddle" | "simulate" | "disabled" {
  if (process.env.PADDLE_API_KEY) return "paddle";
  if (process.env.NODE_ENV !== "production") return "simulate";
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

/**
 * Legacy purchase path (BuyButton → checkoutAction) for products not sold through Paddle.
 * Only the development simulator fulfils them; with Paddle configured they're unavailable.
 * Returns the URL to send the browser to.
 */
export async function startCheckout(viewer: Viewer, code: ProductCode, targetId: string | null) {
  const mode = paymentsMode();
  if (PAYMENTS_PAUSED || mode !== "simulate") throw new ActionError("@msg.paymentsOff");
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

  await fulfillPayment(payment.id, {});
  return absoluteUrl(`/settings/billing?success=${payment.id}`);
}

/**
 * Grants what was purchased. Idempotent: safe to call from both the webhook
 * and any retry. Never trusts the browser — only the server or the Paddle webhook call it.
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

// Paddle subscription IDs are "sub_" + a 26-character lowercase ULID. Older rows in this column
// (it is still named stripeSubscriptionId in the database) may hold IDs Paddle doesn't know.
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
  } else if (paymentsMode() === "disabled") {
    throw new ActionError("@msg.paymentsOff");
  }
  await db.subscription.update({ where: { id: sub.id }, data: { cancelAtPeriodEnd: cancel } });
}

/**
 * The member's Paddle customer: User.paddleCustomerId, else the customer Paddle reported on their
 * latest subscription (the webhook stores it on the Subscription).
 */
export async function paddleCustomerIdFor(userId: string) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { paddleCustomerId: true } });
  if (user?.paddleCustomerId) return user.paddleCustomerId;
  const sub = await db.subscription.findFirst({ where: { userId, paddleCustomerId: { not: null } }, orderBy: { createdAt: "desc" }, select: { paddleCustomerId: true } });
  return sub?.paddleCustomerId ?? null;
}

/** Paddle's customer portal (payment methods, invoices, subscriptions), or null when the member has no Paddle customer yet. */
export async function billingPortalUrl(viewer: Viewer): Promise<string | null> {
  const customerId = await paddleCustomerIdFor(viewer.id);
  if (!customerId) return null;
  return createPaddlePortalSession(customerId);
}
