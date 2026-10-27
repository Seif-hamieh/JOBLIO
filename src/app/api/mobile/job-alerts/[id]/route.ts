import { NextResponse } from "next/server";
import { z } from "zod";
import { LIMITS, rateLimit } from "@/server/rate-limit";
import { deleteJobAlert, setJobAlertEnabled } from "@/server/services/job-alerts";
import { getMobileSession, mobileError } from "@/server/mobile/auth";

export const dynamic = "force-dynamic";

const body = z.object({ alertsEnabled: z.boolean() });

// PATCH /api/mobile/job-alerts/:id  { alertsEnabled }  →  { ok: true }
// Turns an alert on or off. Turning it on starts from now (older jobs aren't announced all at once).
export async function PATCH(req: Request, { params }: RouteContext<"/api/mobile/job-alerts/[id]">) {
  const session = await getMobileSession(req);
  if (!session) return mobileError(401, "UNAUTHORIZED", "Sign in first.");
  if (!rateLimit(`${LIMITS.write.key}:${session.user.id}`, LIMITS.write.max, LIMITS.write.windowMs).ok) return mobileError(429, "RATE_LIMITED", "Slow down a little.");
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return mobileError(400, "INVALID_BODY", "Send alertsEnabled as true or false.");
  const { id } = await params;
  if (!(await setJobAlertEnabled(session.user.id, id.slice(0, 40), parsed.data.alertsEnabled))) return mobileError(404, "NOT_FOUND", "That alert doesn't exist.");
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}

// DELETE /api/mobile/job-alerts/:id  →  204
export async function DELETE(req: Request, { params }: RouteContext<"/api/mobile/job-alerts/[id]">) {
  const session = await getMobileSession(req);
  if (!session) return mobileError(401, "UNAUTHORIZED", "Sign in first.");
  const { id } = await params;
  if (!(await deleteJobAlert(session.user.id, id.slice(0, 40)))) return mobileError(404, "NOT_FOUND", "That alert doesn't exist.");
  return new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
