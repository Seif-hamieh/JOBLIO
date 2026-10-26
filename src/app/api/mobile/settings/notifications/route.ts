import { NextResponse } from "next/server";
import { LIMITS, rateLimit } from "@/server/rate-limit";
import { notificationSchema, updateNotificationSettings } from "@/server/services/settings";
import { getMobileSession, mobileError } from "@/server/mobile/auth";

export const dynamic = "force-dynamic";

// PUT /api/mobile/settings/notifications  { emailNotifications, notifyMessages, notifyApplications, notifyNetwork,
//                                           notifyJobAlerts, notifyPosts, notifyProfileViews }  →  { notifications }
// Every switch is sent each time (the app keeps them all), the same settings the website's Notifications section saves.
export async function PUT(req: Request) {
  const session = await getMobileSession(req);
  if (!session) return mobileError(401, "UNAUTHORIZED", "Sign in first.");
  if (!rateLimit(`${LIMITS.write.key}:${session.user.id}`, LIMITS.write.max, LIMITS.write.windowMs).ok) return mobileError(429, "RATE_LIMITED", "Slow down a little.");
  const parsed = notificationSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return mobileError(400, "INVALID_BODY", "Send every notification switch as true or false.");
  await updateNotificationSettings(session.user.id, parsed.data);
  return NextResponse.json({ notifications: parsed.data }, { headers: { "Cache-Control": "no-store" } });
}
