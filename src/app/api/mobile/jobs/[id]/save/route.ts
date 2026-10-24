import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { LIMITS, rateLimit } from "@/server/rate-limit";
import { setSavedJob } from "@/server/services/saved-jobs";
import { getMobileSession, mobileError } from "@/server/mobile/auth";

export const dynamic = "force-dynamic";

// PUT /api/mobile/jobs/:id/save     → { saved: true }   (bookmark)
// DELETE /api/mobile/jobs/:id/save  → { saved: false }  (remove the bookmark)
// Same as the website's bookmark button (shared service); repeating a call is harmless.
async function handle(req: Request, { params }: RouteContext<"/api/mobile/jobs/[id]/save">, saved: boolean) {
  const session = await getMobileSession(req);
  if (!session) return mobileError(401, "UNAUTHORIZED", "Sign in first.");
  const limit = rateLimit(`${LIMITS.write.key}:${session.user.id}`, LIMITS.write.max, LIMITS.write.windowMs);
  if (!limit.ok) return mobileError(429, "RATE_LIMITED", `Too many requests. Try again in ${limit.retryAfterSeconds} s.`);
  const { id } = await params;
  const result = await setSavedJob(session.user.id, id.slice(0, 40), saved);
  if (!result) return mobileError(404, "NOT_FOUND", "This job doesn't exist.");
  revalidatePath("/jobs/saved");
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}

export function PUT(req: Request, ctx: RouteContext<"/api/mobile/jobs/[id]/save">) {
  return handle(req, ctx, true);
}

export function DELETE(req: Request, ctx: RouteContext<"/api/mobile/jobs/[id]/save">) {
  return handle(req, ctx, false);
}
