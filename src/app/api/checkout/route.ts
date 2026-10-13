import { NextResponse } from "next/server";
import { z } from "zod";
import { getViewer } from "@/server/session";
import { ActionError, fail, localizeState } from "@/server/action";
import { LIMITS, rateLimit } from "@/server/rate-limit";
import { startFeaturedJobCheckout } from "@/server/paddle";
import { getI18n } from "@/i18n/server";
import { k } from "@/i18n/message";

export const dynamic = "force-dynamic";

const body = z.object({
  jobId: z.string().min(1).max(40),
  productCode: z.literal("FEATURED_JOB"),
});

// POST /api/checkout { jobId, productCode } → { transactionId, checkoutUrl }
// Signed-in members only; the job must be theirs (poster or company admin). The Paddle
// API key stays on the server — the browser opens the checkout with the transaction id.
export async function POST(req: Request) {
  const { t } = await getI18n();
  const error = (message: string, status: number) => NextResponse.json({ error: localizeState(t, fail(message)).error }, { status });

  // Same-origin only (the session cookie alone must not be enough to start a purchase).
  const origin = req.headers.get("origin");
  if (!origin || origin !== new URL(req.url).origin) return error(k("msg.error"), 403);

  const viewer = await getViewer();
  if (!viewer) return error(k("msg.signIn"), 401);

  const limit = rateLimit(`${LIMITS.checkout.key}:${viewer.id}`, LIMITS.checkout.max, LIMITS.checkout.windowMs);
  if (!limit.ok) return error(k("msg.tooOften", { s: limit.retryAfterSeconds }), 429);

  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return error(k("msg.error"), 400);

  try {
    const { transactionId, checkoutUrl } = await startFeaturedJobCheckout(viewer, parsed.data.jobId);
    return NextResponse.json({ transactionId, checkoutUrl });
  } catch (err) {
    if (err instanceof ActionError) return error(err.message, 400);
    console.error("[api/checkout]", err);
    return error(k("msg.error"), 500);
  }
}
