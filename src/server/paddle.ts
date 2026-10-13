import "server-only";
import { Environment, Paddle } from "@paddle/paddle-node-sdk";
import { db } from "@/server/db";
import { ActionError } from "@/server/action";
import type { Viewer } from "@/server/session";
import { canManageCompany } from "@/server/session";
import { nextInvoiceNumber } from "@/server/billing";
import { PRODUCTS } from "@/lib/billing/products";

// Paddle Billing for "Feature this job". Paddle is the merchant of record: the buyer
// pays in Paddle's checkout overlay and card data never reaches JOBLIO. Paddle then
// calls /api/webhooks/paddle, which grants the promotion through fulfillPayment().
//
// We create our own PENDING Payment first and pass its id to Paddle as custom_data,
// so the webhook can find it without storing Paddle IDs in the schema.

const environment = () => (process.env.PADDLE_ENVIRONMENT === "production" ? Environment.production : Environment.sandbox);

let client: Paddle | null = null;
export function paddle() {
  if (!process.env.PADDLE_API_KEY) return null;
  client ??= new Paddle(process.env.PADDLE_API_KEY, { environment: environment() });
  return client;
}

/** Featured Job is sold through Paddle when the server key and the price are configured. */
export function paddleEnabled() {
  return !!(process.env.PADDLE_API_KEY && process.env.PADDLE_PRICE_FEATURED_JOB && process.env.PADDLE_CLIENT_TOKEN);
}

/** What the browser needs to open the checkout. The client token is public by design; the API key never leaves the server. */
export function paddleClientConfig() {
  if (!paddleEnabled()) return null;
  return { token: process.env.PADDLE_CLIENT_TOKEN!, environment: environment() === Environment.production ? ("production" as const) : ("sandbox" as const) };
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

/** Creates a PENDING payment and a Paddle transaction for it. */
export async function startFeaturedJobCheckout(viewer: Viewer, jobId: string) {
  const p = paddle();
  if (!p || !paddleEnabled()) throw new ActionError("@msg.paymentsOff");
  const job = await featurableJob(viewer, jobId);
  const product = PRODUCTS.FEATURED_JOB;

  const payment = await db.payment.create({
    data: {
      userId: viewer.id,
      companyId: job.companyId,
      product: "FEATURED_JOB",
      description: product.name,
      amount: product.amount,
      currency: product.currency,
      invoiceNumber: await nextInvoiceNumber(),
      targetId: job.id,
    },
  });

  try {
    const transaction = await p.transactions.create({
      items: [{ priceId: process.env.PADDLE_PRICE_FEATURED_JOB!, quantity: 1 }],
      customData: { paymentId: payment.id, jobId: job.id, userId: viewer.id },
    });
    return { transactionId: transaction.id, checkoutUrl: transaction.checkout?.url ?? null, paymentId: payment.id };
  } catch (err) {
    console.error("[paddle] transaction create failed", err);
    await db.payment.update({ where: { id: payment.id }, data: { status: "FAILED" } });
    throw new ActionError("@msg.checkoutFailed");
  }
}
