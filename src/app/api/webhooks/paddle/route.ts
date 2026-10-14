import { NextResponse } from "next/server";
import { EventName, type EventEntity } from "@paddle/paddle-node-sdk";
import { db } from "@/server/db";
import { fulfillPayment, markPaymentFailed } from "@/server/billing";
import { featuredDays, paddle, profileBoostPaidDays, urgentHirePaidDays } from "@/server/paddle";

export const dynamic = "force-dynamic";

type CustomData = { paymentId?: unknown; jobId?: unknown; userId?: unknown };

/** Our PENDING payment for a Paddle transaction, checked against what was bought. */
async function paymentFor(customData: unknown) {
  const data = (customData ?? {}) as CustomData;
  if (typeof data.paymentId !== "string") return null;
  const payment = await db.payment.findUnique({ where: { id: data.paymentId } });
  if (!payment) return null;
  if (payment.product === "FEATURED_JOB" && payment.targetId === data.jobId) return payment;
  if (payment.product === "PROFILE_BOOST" && payment.userId === data.userId) return payment;
  if (payment.product === "URGENT_HIRE" && payment.targetId === data.jobId && payment.userId === data.userId) return payment;
  return null;
}

async function handle(event: EventEntity) {
  switch (event.eventType) {
    case EventName.TransactionCompleted: {
      const txn = event.data;
      const payment = await paymentFor(txn.customData);
      if (!payment) {
        console.warn("[paddle webhook] no matching payment for", txn.id);
        return;
      }
      // Record what Paddle actually charged (incl. any tax), in minor units.
      const totals = txn.details?.totals;
      const amount = Number(totals?.grandTotal ?? totals?.total);
      if (Number.isFinite(amount) && amount > 0 && payment.status !== "SUCCEEDED") {
        await db.payment.update({ where: { id: payment.id }, data: { amount, currency: txn.currencyCode.toLowerCase() } });
      }
      // Idempotent: does nothing if this payment was already fulfilled.
      const days =
        payment.product === "PROFILE_BOOST"
          ? profileBoostPaidDays(txn.items, txn.customData)
          : payment.product === "URGENT_HIRE"
            ? urgentHirePaidDays(txn.items, txn.customData)
            : featuredDays(txn.items, txn.customData);
      await fulfillPayment(payment.id, { days });
      return;
    }
    case EventName.TransactionPaymentFailed: {
      // The buyer can retry in the same checkout; a later transaction.completed still fulfils it.
      const payment = await paymentFor(event.data.customData);
      if (payment) await markPaymentFailed(payment.id);
      console.warn("[paddle webhook] payment failed for", event.data.id);
      return;
    }
  }
}

// POST /api/webhooks/paddle — verified with the notification destination's secret key.
export async function POST(req: Request) {
  const p = paddle();
  const secret = process.env.PADDLE_WEBHOOK_SECRET;
  if (!p || !secret) return NextResponse.json({ error: "Not configured" }, { status: 404 });

  const signature = req.headers.get("paddle-signature") ?? "";
  const body = await req.text(); // raw body: the signature covers the exact bytes
  let event: EventEntity;
  try {
    event = await p.webhooks.unmarshal(body, secret, signature);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Idempotency: each Paddle event is processed once (Paddle retries until it gets a 2xx).
  const eventKey = `paddle:${event.eventId}`;
  try {
    await db.webhookEvent.create({ data: { id: eventKey, type: event.eventType } });
  } catch {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    await handle(event);
  } catch (err) {
    console.error("[paddle webhook]", event.eventType, err);
    // Let Paddle retry: forget that we saw this event.
    await db.webhookEvent.delete({ where: { id: eventKey } }).catch(() => {});
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}
