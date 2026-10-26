import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/server/db";
import { isExpoPushToken } from "@/server/push";
import { LIMITS, rateLimit } from "@/server/rate-limit";
import { getMobileSession, mobileError } from "@/server/mobile/auth";

export const dynamic = "force-dynamic";

const body = z.object({
  token: z.string().trim().max(255).refine(isExpoPushToken),
  platform: z.enum(["android", "ios"]).catch("android"),
});

// POST /api/mobile/push-devices  { token, platform }  →  204
// The app registers this phone's Expo push token after sign-in (and again on each launch, which is harmless).
// A token belongs to whoever signed in on that phone last, so after switching accounts the old one stops receiving.
export async function POST(req: Request) {
  const session = await getMobileSession(req);
  if (!session) return mobileError(401, "UNAUTHORIZED", "Sign in first.");
  if (!rateLimit(`${LIMITS.write.key}:${session.user.id}`, LIMITS.write.max, LIMITS.write.windowMs).ok) return mobileError(429, "RATE_LIMITED", "Slow down a little.");
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return mobileError(400, "INVALID_TOKEN", "Send an Expo push token.");
  const { token, platform } = parsed.data;
  await db.pushDevice.upsert({ where: { token }, create: { token, platform, userId: session.user.id }, update: { userId: session.user.id, platform } });
  return new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}

// DELETE /api/mobile/push-devices  { token }  →  204
// On sign-out the app removes this phone, so the next person to use it doesn't get the last member's notifications.
export async function DELETE(req: Request) {
  const session = await getMobileSession(req);
  if (!session) return mobileError(401, "UNAUTHORIZED", "Sign in first.");
  const parsed = body.pick({ token: true }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return mobileError(400, "INVALID_TOKEN", "Send an Expo push token.");
  await db.pushDevice.deleteMany({ where: { token: parsed.data.token, userId: session.user.id } });
  return new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
