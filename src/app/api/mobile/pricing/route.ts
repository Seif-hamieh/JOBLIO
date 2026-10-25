import { NextResponse } from "next/server";
import { cacheHeaders } from "@/server/mobile/auth";
import { BUSINESS_PRODUCTS, MEMBER_PRODUCTS, PAYMENTS_PAUSED, PRODUCTS, type ProductCode } from "@/lib/billing/products";

const toPlan = (code: ProductCode) => {
  const p = PRODUCTS[code];
  return { code: p.code, name: p.name, amount: p.amount, currency: p.currency, mode: p.mode, days: p.days ?? null, tagline: p.tagline, features: p.features };
};

// GET /api/mobile/pricing  →  { paymentsPaused, members, business }
// JOBLIO Premium plans and prices for reading only (lib/billing/products). Buying is not part of the app yet.
// The same for everyone: cached by the CDN for a minute.
export function GET() {
  return NextResponse.json({ paymentsPaused: PAYMENTS_PAUSED, members: MEMBER_PRODUCTS.map(toPlan), business: BUSINESS_PRODUCTS.map(toPlan) }, { headers: cacheHeaders(false) });
}
