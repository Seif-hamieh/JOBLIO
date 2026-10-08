import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { db } from "@/server/db";
import { fulfillPayment, markPaymentFailed, stripe, syncStripeSubscription } from "@/server/billing";
import { PRODUCTS } from "@/lib/billing/products";

export const dynamic = "force-dynamic";

const idOf = (v: string | { id: string } | null | undefined) => (typeof v === "string" ? v : (v?.id ?? null));

async function periodEndOf(subscriptionId: string | null) {
  if (!subscriptionId) return null;
  const sub = await stripe()!.subscriptions.retrieve(subscriptionId);
  const end = sub.items.data[0]?.current_period_end;
  return end ? new Date(end * 1000) : null;
}

async function handle(event: Stripe.Event) {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object;
      const paymentId = session.metadata?.paymentId;
      if (!paymentId) return;
      // Delayed payment methods complete later via async_payment_succeeded.
      if (session.mode === "payment" && session.payment_status !== "paid") return;
      const subscriptionId = idOf(session.subscription);
      await fulfillPayment(paymentId, {
        paymentIntentId: idOf(session.payment_intent),
        subscriptionId,
        periodEnd: await periodEndOf(subscriptionId),
        invoiceId: idOf(session.invoice),
      });
      return;
    }
    case "checkout.session.async_payment_failed":
    case "checkout.session.expired": {
      const paymentId = event.data.object.metadata?.paymentId;
      if (paymentId) await markPaymentFailed(paymentId);
      return;
    }
    case "invoice.paid": {
      // Subscription renewals: record the payment and extend the period.
      const invoice = event.data.object;
      if (invoice.billing_reason !== "subscription_cycle") return;
      const subscriptionId = idOf(invoice.parent?.subscription_details?.subscription);
      if (!subscriptionId) return;
      const local = await db.subscription.findUnique({ where: { stripeSubscriptionId: subscriptionId } });
      if (!local) return;
      const product = PRODUCTS[local.product];
      await db.payment.upsert({
        where: { invoiceNumber: invoice.number ?? invoice.id! },
        update: {},
        create: {
          userId: local.userId,
          companyId: local.companyId,
          product: local.product,
          description: `${product.name} · renewal`,
          amount: invoice.amount_paid,
          currency: invoice.currency,
          status: "SUCCEEDED",
          invoiceNumber: invoice.number ?? invoice.id!,
          stripeInvoiceId: invoice.id,
          receiptUrl: invoice.hosted_invoice_url ?? null,
          paidAt: new Date(),
        },
      });
      await syncStripeSubscription(await stripe()!.subscriptions.retrieve(subscriptionId));
      return;
    }
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await syncStripeSubscription(event.data.object);
      return;
  }
}

// POST /api/webhooks/stripe — verified with the endpoint's signing secret.
export async function POST(req: Request) {
  const s = stripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!s || !secret) return NextResponse.json({ error: "Not configured" }, { status: 404 });

  const signature = req.headers.get("stripe-signature");
  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = s.webhooks.constructEvent(body, signature ?? "", secret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Idempotency: each event is processed once.
  try {
    await db.webhookEvent.create({ data: { id: event.id, type: event.type } });
  } catch {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    await handle(event);
  } catch (err) {
    console.error("[stripe webhook]", event.type, err);
    // Let Stripe retry: forget that we saw this event.
    await db.webhookEvent.delete({ where: { id: event.id } }).catch(() => {});
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}
