import { NextResponse } from "next/server";
import { z } from "zod";
import { getViewer } from "@/server/session";
import { ActionError, fail, localizeState } from "@/server/action";
import { LIMITS, rateLimit } from "@/server/rate-limit";
import {
  startFeaturedJobCheckout,
  startPriorityApplicationCheckout,
  startProfileBoostCheckout,
  startSubscriptionCheckout,
  startUrgentHireCheckout,
} from "@/server/paddle";
import { getI18n } from "@/i18n/server";
import { k } from "@/i18n/message";
import {
  FEATURED_JOB_PLAN_CODES,
  PAYMENTS_PAUSED,
  PRIORITY_APPLICATION_PLAN_CODES,
  PROFILE_BOOST_PLAN_CODES,
  SUBSCRIPTION_PLAN_CODES,
  URGENT_HIRE_PLAN_CODES,
  type PriorityApplicationPlanCode,
  type ProfileBoostPlanCode,
  type SubscriptionPlanCode,
  type UrgentHirePlanCode,
} from "@/lib/billing/products";

export const dynamic = "force-dynamic";

const body = z
  .object({
    // Featured Job needs the job; Profile Boost is for the member's own profile.
    jobId: z.string().min(1).max(40).optional(),
    planCode: z
      .enum([...FEATURED_JOB_PLAN_CODES, ...PROFILE_BOOST_PLAN_CODES, ...URGENT_HIRE_PLAN_CODES, ...PRIORITY_APPLICATION_PLAN_CODES, ...SUBSCRIPTION_PLAN_CODES])
      .optional(),
    // Pages still open from before the plans existed send only productCode: treat it as the 30-day plan.
    productCode: z.literal("FEATURED_JOB").optional(),
  })
  .refine((b) => b.planCode || b.productCode);

const isProfileBoost = (code: string | undefined): code is ProfileBoostPlanCode => !!code && (PROFILE_BOOST_PLAN_CODES as string[]).includes(code);
const isUrgentHire = (code: string | undefined): code is UrgentHirePlanCode => !!code && (URGENT_HIRE_PLAN_CODES as string[]).includes(code);
const isPriorityApplication = (code: string | undefined): code is PriorityApplicationPlanCode => !!code && (PRIORITY_APPLICATION_PLAN_CODES as string[]).includes(code);
const isSubscription = (code: string | undefined): code is SubscriptionPlanCode => !!code && (SUBSCRIPTION_PLAN_CODES as string[]).includes(code);

// POST /api/checkout { jobId, planCode } (Featured Job, Urgent Hire) or { planCode } (Profile Boost, Priority Application,
// subscriptions — Company Premium takes the company from the viewer) → { transactionId, checkoutUrl }
// Signed-in members only; the job must be theirs (poster or company admin). The Paddle
// API key stays on the server — the browser opens the checkout with the transaction id.
export async function POST(req: Request) {
  const { t } = await getI18n();
  const error = (message: string, status: number) => NextResponse.json({ error: localizeState(t, fail(message)).error }, { status });

  // Same-origin only (the session cookie alone must not be enough to start a purchase).
  const origin = req.headers.get("origin");
  if (!origin || origin !== new URL(req.url).origin) return error(k("msg.error"), 403);

  // Payments are paused (see PAYMENTS_PAUSED): refuse before anything is created at Paddle.
  if (PAYMENTS_PAUSED) return error(k("msg.paymentsOff"), 503);

  const viewer = await getViewer();
  if (!viewer) return error(k("msg.signIn"), 401);

  const limit = rateLimit(`${LIMITS.checkout.key}:${viewer.id}`, LIMITS.checkout.max, LIMITS.checkout.windowMs);
  if (!limit.ok) return error(k("msg.tooOften", { s: limit.retryAfterSeconds }), 429);

  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return error(k("msg.error"), 400);

  const { jobId, planCode } = parsed.data;
  if (!isProfileBoost(planCode) && !isPriorityApplication(planCode) && !isSubscription(planCode) && !jobId) return error(k("msg.error"), 400);

  try {
    const { transactionId, checkoutUrl } = isSubscription(planCode)
      ? await startSubscriptionCheckout({ viewer, planCode })
      : isProfileBoost(planCode)
        ? await startProfileBoostCheckout(viewer, planCode)
        : isPriorityApplication(planCode)
          ? await startPriorityApplicationCheckout({ userId: viewer.id, planCode })
          : isUrgentHire(planCode)
            ? await startUrgentHireCheckout(viewer, jobId!, planCode)
            : await startFeaturedJobCheckout(viewer, jobId!, planCode ?? "FEATURED_JOB_30D");
    return NextResponse.json({ transactionId, checkoutUrl });
  } catch (err) {
    if (err instanceof ActionError) return error(err.message, 400);
    console.error("[api/checkout]", err);
    return error(k("msg.error"), 500);
  }
}
