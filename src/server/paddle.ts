import "server-only";
import { Environment, Paddle } from "@paddle/paddle-node-sdk";
import { db } from "@/server/db";
import { ActionError } from "@/server/action";
import type { Viewer } from "@/server/session";
import { canManageCompany } from "@/server/session";
import { nextInvoiceNumber } from "@/server/billing";
import { FEATURED_JOB_PLANS, PRODUCTS, type FeaturedJobPlan, type FeaturedJobPlanCode } from "@/lib/billing/products";

// Paddle Billing for "Feature this job". Paddle is the merchant of record: the buyer
// pays in Paddle's checkout overlay and card data never reaches JOBLIO. Paddle then
// calls /api/webhooks/paddle, which grants the promotion through fulfillPayment().
//
// We create our own PENDING Payment first and pass its id (plus the plan's duration)
// to Paddle as custom_data, so the webhook can find it without storing Paddle IDs in the schema.

const environment = () => (process.env.PADDLE_ENVIRONMENT === "production" ? Environment.production : Environment.sandbox);

let client: Paddle | null = null;
export function paddle() {
  if (!process.env.PADDLE_API_KEY) return null;
  client ??= new Paddle(process.env.PADDLE_API_KEY, { environment: environment() });
  return client;
}

/**
 * The Featured Job plans that can be bought right now: those whose Paddle price is configured.
 * Compatibility: with none of PADDLE_PRICE_FEATURED_JOB_7D/14D/30D set, the original single
 * plan (PADDLE_PRICE_FEATURED_JOB — 30 days) keeps working.
 */
export function featuredJobPlans(): FeaturedJobPlan[] {
  const plans = FEATURED_JOB_PLANS.filter((p) => p.priceId);
  if (plans.length) return plans;
  const legacy = process.env.PADDLE_PRICE_FEATURED_JOB;
  return legacy ? [{ code: "FEATURED_JOB_30D", priceId: legacy, durationDays: PRODUCTS.FEATURED_JOB.days!, amount: PRODUCTS.FEATURED_JOB.amount }] : [];
}

/** The plan a Paddle price belongs to (also matches the legacy single price). */
export function planForPriceId(priceId: string | null | undefined) {
  return priceId ? (featuredJobPlans().find((p) => p.priceId === priceId) ?? null) : null;
}

const PLAN_DAYS = new Set([7, 14, 30]);

/**
 * How long to feature the job. The price that was actually paid decides when we know it;
 * otherwise custom_data.durationDays (set by our server at checkout), then the 30-day default
 * (transactions created before plans existed carry no duration).
 */
export function featuredDays(items: { price?: { id?: string | null } | null }[] | null | undefined, customData: unknown): number | null {
  for (const item of items ?? []) {
    const plan = planForPriceId(item.price?.id);
    if (plan) return plan.durationDays;
  }
  const days = Number((customData as { durationDays?: unknown } | null)?.durationDays);
  return PLAN_DAYS.has(days) ? days : null;
}

/** Featured Job is sold through Paddle when the server key, the client token and at least one price are configured. */
export function paddleEnabled() {
  return !!(process.env.PADDLE_API_KEY && process.env.PADDLE_CLIENT_TOKEN && featuredJobPlans().length);
}

/** What the browser needs to open the checkout. The client token is public by design; the API key never leaves the server. */
export function paddleClientConfig() {
  if (!paddleEnabled()) return null;
  return { token: process.env.PADDLE_CLIENT_TOKEN!, environment: environment() === Environment.production ? ("production" as const) : ("sandbox" as const) };
}

/** Plans as shown in the browser — no price IDs. */
export function featuredJobPlanOptions() {
  return featuredJobPlans().map(({ code, durationDays, amount }) => ({ code, durationDays, amount }));
}

const isFeatured = (until: Date | null) => !!until && until > new Date();

/** The job's poster or an owner/admin of its company may feature it, while it's open and not already featured. */
export async function featurableJob(viewer: Viewer, jobId: string) {
  const job = await db.job.findUnique({ where: { id: jobId }, select: { id: true, title: true, companyId: true, postedById: true, status: true, featuredUntil: true } });
  if (!job || (job.postedById !== viewer.id && !canManageCompany(viewer, job.companyId))) throw new ActionError("@msg.featureNotAllowed");
  if (job.status !== "OPEN") throw new ActionError("@msg.openJobsOnly");
  if (isFeatured(job.featuredUntil)) throw new ActionError("@msg.alreadyFeatured");
  return job;
}

export function canFeatureJob(viewer: Viewer | null, job: { companyId: string; postedById: string; status: string; featuredUntil: Date | null }) {
  return !!viewer && (job.postedById === viewer.id || canManageCompany(viewer, job.companyId)) && job.status === "OPEN" && !isFeatured(job.featuredUntil);
}

/** Creates a PENDING payment and a Paddle transaction for the chosen plan. */
export async function startFeaturedJobCheckout(viewer: Viewer, jobId: string, planCode: FeaturedJobPlanCode) {
  const p = paddle();
  if (!p || !paddleEnabled()) throw new ActionError("@msg.paymentsOff");
  const plan = featuredJobPlans().find((x) => x.code === planCode);
  if (!plan) throw new ActionError("@msg.planUnavailable");
  const job = await featurableJob(viewer, jobId);
  const product = PRODUCTS.FEATURED_JOB;

  const payment = await db.payment.create({
    data: {
      userId: viewer.id,
      companyId: job.companyId,
      product: "FEATURED_JOB",
      description: `Featured Job · ${plan.durationDays} days`,
      amount: plan.amount,
      currency: product.currency,
      invoiceNumber: await nextInvoiceNumber(),
      targetId: job.id,
    },
  });

  try {
    const transaction = await p.transactions.create({
      items: [{ priceId: plan.priceId!, quantity: 1 }],
      customData: { paymentId: payment.id, jobId: job.id, userId: viewer.id, planCode: plan.code, durationDays: plan.durationDays },
    });
    return { transactionId: transaction.id, checkoutUrl: transaction.checkout?.url ?? null, paymentId: payment.id };
  } catch (err) {
    console.error("[paddle] transaction create failed", err);
    await db.payment.update({ where: { id: payment.id }, data: { status: "FAILED" } });
    throw new ActionError("@msg.checkoutFailed");
  }
}
