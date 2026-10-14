import "server-only";
import { Environment, Paddle } from "@paddle/paddle-node-sdk";
import { db } from "@/server/db";
import { ActionError } from "@/server/action";
import type { Viewer } from "@/server/session";
import { canManageCompany } from "@/server/session";
import { nextInvoiceNumber } from "@/server/billing";
import {
  FEATURED_JOB_PLANS,
  PRIORITY_APPLICATION_PLANS,
  PROFILE_BOOST_PLANS,
  PRODUCTS,
  SUBSCRIPTION_PLANS,
  URGENT_HIRE_PLANS,
  findSubscriptionPlan,
  type FeaturedJobPlan,
  type FeaturedJobPlanCode,
  type PriorityApplicationPlanCode,
  type ProfileBoostPlanCode,
  type SubscriptionPlanCode,
  type SubscriptionProductCode,
  type UrgentHirePlanCode,
} from "@/lib/billing/products";

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

// ── Profile Boost (Paddle) ──────────────────────────────────────────────────
// Same flow as Featured Job, for the member's own profile (no target): a PENDING
// PROFILE_BOOST payment + a Paddle transaction; the webhook grants the boost.

/** Profile Boost plans whose Paddle price is configured. */
export function profileBoostPlans() {
  return PROFILE_BOOST_PLANS.filter((p) => p.priceId);
}

/** Plans as shown in the browser — no price IDs. */
export function profileBoostPlanOptions() {
  return profileBoostPlans().map(({ code, durationDays, amount }) => ({ code, durationDays, amount }));
}

/** Boost length: the price that was actually paid, else custom_data.durationDays, else null (product default). */
export function profileBoostPaidDays(items: { price?: { id?: string | null } | null }[] | null | undefined, customData: unknown): number | null {
  for (const item of items ?? []) {
    const plan = profileBoostPlans().find((p) => p.priceId === item.price?.id);
    if (plan) return plan.durationDays;
  }
  const days = Number((customData as { durationDays?: unknown } | null)?.durationDays);
  return PLAN_DAYS.has(days) ? days : null;
}

/** Creates a PENDING Profile Boost payment and a Paddle transaction for the chosen plan. */
export async function startProfileBoostCheckout(viewer: Viewer, planCode: ProfileBoostPlanCode) {
  const p = paddle();
  if (!p || !process.env.PADDLE_CLIENT_TOKEN) throw new ActionError("@msg.paymentsOff");
  const plan = profileBoostPlans().find((x) => x.code === planCode);
  if (!plan) throw new ActionError("@msg.planUnavailable");

  const payment = await db.payment.create({
    data: {
      userId: viewer.id,
      product: "PROFILE_BOOST",
      description: `Profile Boost · ${plan.durationDays} days`,
      amount: plan.amount,
      currency: PRODUCTS.PROFILE_BOOST.currency,
      invoiceNumber: await nextInvoiceNumber(),
    },
  });

  try {
    const transaction = await p.transactions.create({
      items: [{ priceId: plan.priceId!, quantity: 1 }],
      customData: { paymentId: payment.id, userId: viewer.id, product: "PROFILE_BOOST", planCode: plan.code, durationDays: plan.durationDays },
    });
    return { transactionId: transaction.id, checkoutUrl: transaction.checkout?.url ?? null, paymentId: payment.id };
  } catch (err) {
    console.error("[paddle] transaction create failed", err);
    await db.payment.update({ where: { id: payment.id }, data: { status: "FAILED" } });
    throw new ActionError("@msg.checkoutFailed");
  }
}

// ── Priority Application (Paddle) ───────────────────────────────────────────
// Same flow as Profile Boost (no target): a PENDING PRIORITY_APPLICATION payment +
// a Paddle transaction; the webhook adds the pack's credits to the member.

/** Priority Application packs whose Paddle price is configured. */
export function priorityApplicationPlans() {
  return PRIORITY_APPLICATION_PLANS.filter((p) => p.priceId);
}

/** Packs as shown in the browser — no price IDs. */
export function priorityApplicationPlanOptions() {
  return priorityApplicationPlans().map(({ code, credits, amount }) => ({ code, credits, amount }));
}

const PACK_CREDITS = new Set([1, 5, 10]);

/** Credits bought: the price that was actually paid, else custom_data.credits, else null (description parser). */
export function priorityApplicationPaidCredits(items: { price?: { id?: string | null } | null }[] | null | undefined, customData: unknown): number | null {
  for (const item of items ?? []) {
    const plan = priorityApplicationPlans().find((p) => p.priceId === item.price?.id);
    if (plan) return plan.credits;
  }
  const credits = Number((customData as { credits?: unknown } | null)?.credits);
  return PACK_CREDITS.has(credits) ? credits : null;
}

/** Creates a PENDING Priority Application payment and a Paddle transaction for the chosen pack. */
export async function startPriorityApplicationCheckout({ userId, planCode }: { userId: string; planCode: PriorityApplicationPlanCode }) {
  const p = paddle();
  if (!p || !process.env.PADDLE_CLIENT_TOKEN) throw new ActionError("@msg.paymentsOff");
  const plan = priorityApplicationPlans().find((x) => x.code === planCode);
  if (!plan) throw new ActionError("@msg.planUnavailable");

  const payment = await db.payment.create({
    data: {
      userId,
      product: "PRIORITY_APPLICATION",
      description: `Priority Application · ${plan.credits} pack`,
      amount: plan.amount,
      currency: PRODUCTS.PRIORITY_APPLICATION.currency,
      invoiceNumber: await nextInvoiceNumber(),
      targetId: null,
    },
  });

  try {
    const transaction = await p.transactions.create({
      items: [{ priceId: plan.priceId!, quantity: 1 }],
      customData: { paymentId: payment.id, userId, product: "PRIORITY_APPLICATION", planCode: plan.code, credits: plan.credits },
    });
    return { transactionId: transaction.id, checkoutUrl: transaction.checkout?.url ?? null, paymentId: payment.id };
  } catch (err) {
    console.error("[paddle] transaction create failed", err);
    await db.payment.update({ where: { id: payment.id }, data: { status: "FAILED" } });
    throw new ActionError("@msg.checkoutFailed");
  }
}

// ── Urgent Hire (Paddle) ────────────────────────────────────────────────────
// Same flow as Featured Job: the poster or a company admin flags an open job as urgent.
// Independent of Featured — a featured job can also be urgent.

/** Urgent Hire plans whose Paddle price is configured. */
export function urgentHirePlans() {
  return URGENT_HIRE_PLANS.filter((p) => p.priceId);
}

/** Plans as shown in the browser — no price IDs. */
export function urgentHirePlanOptions() {
  return urgentHirePlans().map(({ code, durationDays, amount }) => ({ code, durationDays, amount }));
}

/** Urgent length: the price that was actually paid, else custom_data.durationDays, else null (product default). */
export function urgentHirePaidDays(items: { price?: { id?: string | null } | null }[] | null | undefined, customData: unknown): number | null {
  for (const item of items ?? []) {
    const plan = urgentHirePlans().find((p) => p.priceId === item.price?.id);
    if (plan) return plan.durationDays;
  }
  const days = Number((customData as { durationDays?: unknown } | null)?.durationDays);
  return PLAN_DAYS.has(days) ? days : null;
}

export function canMarkJobUrgent(viewer: Viewer | null, job: { companyId: string; postedById: string; status: string; urgentUntil: Date | null }) {
  return !!viewer && (job.postedById === viewer.id || canManageCompany(viewer, job.companyId)) && job.status === "OPEN" && !isFeatured(job.urgentUntil);
}

/** Creates a PENDING Urgent Hire payment and a Paddle transaction for the chosen plan and job. */
export async function startUrgentHireCheckout(viewer: Viewer, jobId: string, planCode: UrgentHirePlanCode) {
  const p = paddle();
  if (!p || !process.env.PADDLE_CLIENT_TOKEN) throw new ActionError("@msg.paymentsOff");
  const plan = urgentHirePlans().find((x) => x.code === planCode);
  if (!plan) throw new ActionError("@msg.planUnavailable");

  const job = await db.job.findUnique({ where: { id: jobId }, select: { id: true, companyId: true, postedById: true, status: true, urgentUntil: true } });
  if (!job || (job.postedById !== viewer.id && !canManageCompany(viewer, job.companyId))) throw new ActionError("@msg.featureNotAllowed");
  if (job.status !== "OPEN") throw new ActionError("@msg.openJobsOnly");
  if (isFeatured(job.urgentUntil)) throw new ActionError("@msg.alreadyUrgent");

  const payment = await db.payment.create({
    data: {
      userId: viewer.id,
      companyId: job.companyId,
      product: "URGENT_HIRE",
      description: `Urgent Hire · ${plan.durationDays} days`,
      amount: plan.amount,
      currency: PRODUCTS.URGENT_HIRE.currency,
      invoiceNumber: await nextInvoiceNumber(),
      targetId: job.id,
    },
  });

  try {
    const transaction = await p.transactions.create({
      items: [{ priceId: plan.priceId!, quantity: 1 }],
      customData: { paymentId: payment.id, userId: viewer.id, product: "URGENT_HIRE", planCode: plan.code, durationDays: plan.durationDays, jobId: job.id },
    });
    return { transactionId: transaction.id, checkoutUrl: transaction.checkout?.url ?? null, paymentId: payment.id };
  } catch (err) {
    console.error("[paddle] transaction create failed", err);
    await db.payment.update({ where: { id: payment.id }, data: { status: "FAILED" } });
    throw new ActionError("@msg.checkoutFailed");
  }
}

// ── Subscriptions (Paddle, recurring) ───────────────────────────────────────
// Job Seeker Pro (member) and Company Premium (company owners/admins). Paddle owns the
// subscription: checkout only creates the first transaction; the webhook mirrors the
// subscription (subscription.*) and records each charge as a Payment (transaction.completed).

/** A product's plans (monthly + yearly) whose Paddle price is configured — no price IDs. */
export function subscriptionPlanOptions(product: SubscriptionProductCode) {
  return SUBSCRIPTION_PLANS.filter((p) => p.product === product && p.priceId).map(({ code, interval, amount }) => ({ code, interval, amount }));
}

const LIVE_SUBSCRIPTION = ["ACTIVE", "TRIALING", "PAST_DUE"] as const;

/** Creates the first Paddle transaction for a subscription plan. No Payment row yet — the webhook records each charge. */
export async function startSubscriptionCheckout({ viewer, planCode }: { viewer: Viewer; planCode: SubscriptionPlanCode }) {
  const p = paddle();
  if (!p || !process.env.PADDLE_CLIENT_TOKEN) throw new ActionError("@msg.paymentsOff");
  const plan = findSubscriptionPlan(planCode);
  if (!plan?.priceId) throw new ActionError("@msg.planUnavailable");

  // Company Premium belongs to the company: owners/admins only.
  let companyId: string | null = null;
  if (plan.product === "COMPANY_PREMIUM") {
    if (!viewer.company) throw new ActionError("@msg.needWorkspaceProduct");
    if (!canManageCompany(viewer, viewer.company.id)) throw new ActionError("@msg.adminsOnlyUpgrade");
    companyId = viewer.company.id;
  }
  const active = await db.subscription.findFirst({
    where: { product: plan.product, status: { in: [...LIVE_SUBSCRIPTION] }, currentPeriodEnd: { gt: new Date() }, ...(companyId ? { companyId } : { userId: viewer.id }) },
    select: { id: true },
  });
  if (active) throw new ActionError("@msg.alreadyHavePlan");

  try {
    const transaction = await p.transactions.create({
      items: [{ priceId: plan.priceId, quantity: 1 }],
      customData: { userId: viewer.id, product: plan.product, planCode: plan.code, interval: plan.interval, ...(companyId && { companyId }) },
    });
    return { transactionId: transaction.id, checkoutUrl: transaction.checkout?.url ?? null };
  } catch (err) {
    console.error("[paddle] subscription transaction create failed", err);
    throw new ActionError("@msg.checkoutFailed");
  }
}

/** e.g. "Job Seeker Pro · Monthly" */
export function subscriptionDescription(product: SubscriptionProductCode, interval: "month" | "year") {
  return `${PRODUCTS[product].name} · ${interval === "month" ? "Monthly" : "Yearly"}`;
}

type SubscriptionCustomData = { userId: string; product: SubscriptionProductCode; companyId: string | null };

/** The checkout's custom_data (Paddle copies it onto the subscription), validated. */
function subscriptionCustomData(customData: unknown): SubscriptionCustomData | null {
  const d = (customData ?? {}) as { userId?: unknown; product?: unknown; companyId?: unknown };
  if (typeof d.userId !== "string" || (d.product !== "JOB_SEEKER_PRO" && d.product !== "COMPANY_PREMIUM")) return null;
  return { userId: d.userId, product: d.product, companyId: typeof d.companyId === "string" ? d.companyId : null };
}

const SUBSCRIPTION_STATUS = { active: "ACTIVE", trialing: "TRIALING", past_due: "PAST_DUE", paused: "PAST_DUE", canceled: "CANCELED" } as const;

type PaddleSubscriptionEvent = {
  id: string;
  status: string;
  customerId: string;
  customData: unknown;
  currentBillingPeriod: { endsAt: string } | null;
  scheduledChange: { action: string } | null;
};

/**
 * Mirrors a Paddle subscription (subscription.created/activated/updated/past_due/canceled) into our
 * Subscription table, keyed by paddleSubscriptionId — idempotent and safe for out-of-order events.
 * Company Premium also keeps company.premiumUntil in sync.
 */
export async function syncPaddleSubscription(sub: PaddleSubscriptionEvent) {
  const status = SUBSCRIPTION_STATUS[sub.status as keyof typeof SUBSCRIPTION_STATUS] ?? "PAST_DUE";
  const currentPeriodEnd = sub.currentBillingPeriod ? new Date(sub.currentBillingPeriod.endsAt) : new Date();
  const fields = { status, currentPeriodEnd, cancelAtPeriodEnd: sub.scheduledChange?.action === "cancel", paddleCustomerId: sub.customerId };

  const data = subscriptionCustomData(sub.customData);
  let row: { product: string; companyId: string | null } | null = null;
  if (data && (await db.user.findUnique({ where: { id: data.userId }, select: { id: true } }))) {
    row = await db.subscription.upsert({
      where: { paddleSubscriptionId: sub.id },
      update: fields,
      create: { ...fields, userId: data.userId, companyId: data.companyId, product: data.product, paddleSubscriptionId: sub.id },
      select: { product: true, companyId: true },
    });
  } else {
    // No usable custom_data: only update a subscription we already know.
    const updated = await db.subscription.updateMany({ where: { paddleSubscriptionId: sub.id }, data: fields });
    if (!updated.count) {
      console.warn("[paddle webhook] unknown subscription without custom_data", sub.id);
      return;
    }
    row = await db.subscription.findUnique({ where: { paddleSubscriptionId: sub.id }, select: { product: true, companyId: true } });
  }

  if (row?.product === "COMPANY_PREMIUM" && row.companyId) {
    await db.company.update({ where: { id: row.companyId }, data: { premiumUntil: status === "CANCELED" ? new Date() : currentPeriodEnd } });
  }
}

type PaddleSubscriptionTransaction = {
  id: string;
  subscriptionId: string | null;
  invoiceNumber: string | null;
  currencyCode: string;
  customData: unknown;
  items: { price?: { id?: string | null } | null }[];
  details: { totals: { grandTotal?: string | null; total?: string | null } | null } | null;
};

/** Records a completed subscription charge (first payment and every renewal) as a SUCCEEDED Payment. Idempotent. */
export async function recordSubscriptionPayment(txn: PaddleSubscriptionTransaction) {
  if (!txn.subscriptionId) return false;
  const plan = SUBSCRIPTION_PLANS.find((p) => p.priceId && txn.items.some((i) => i.price?.id === p.priceId));
  const local = await db.subscription.findUnique({ where: { paddleSubscriptionId: txn.subscriptionId }, select: { userId: true, companyId: true, product: true } });
  const data = subscriptionCustomData(txn.customData);
  const userId = local?.userId ?? data?.userId;
  const product = (plan?.product ?? local?.product ?? data?.product) as SubscriptionProductCode | undefined;
  if (!userId || !product || !(await db.user.findUnique({ where: { id: userId }, select: { id: true } }))) {
    console.warn("[paddle webhook] subscription charge without a known member", txn.id);
    return true;
  }
  const totals = txn.details?.totals;
  const amount = Number(totals?.grandTotal ?? totals?.total);
  const invoiceNumber = txn.invoiceNumber ?? txn.id;
  await db.payment.upsert({
    where: { invoiceNumber },
    update: {},
    create: {
      userId,
      companyId: local?.companyId ?? data?.companyId ?? null,
      product,
      description: subscriptionDescription(product, plan?.interval ?? "month"),
      amount: Number.isFinite(amount) ? amount : (plan?.amount ?? PRODUCTS[product].amount),
      currency: txn.currencyCode.toLowerCase(),
      status: "SUCCEEDED",
      invoiceNumber,
      paidAt: new Date(),
    },
  });
  return true;
}

/**
 * A short-lived link to Paddle's customer portal (payment methods, invoices, cancel) —
 * POST /customers/{customer_id}/portal-sessions. Returns the general overview URL, or null on failure.
 */
export async function createPaddlePortalSession(customerId: string): Promise<string | null> {
  const p = paddle();
  if (!p) return null;
  try {
    const session = await p.customerPortalSessions.create(customerId, []);
    return session.urls.general.overview;
  } catch (err) {
    console.error("[paddle] portal session failed", err);
    return null;
  }
}
