import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { getNotificationSettings, getPrivacySettings } from "@/server/services/settings";
import { getMobileSession, mobileError } from "@/server/mobile/auth";

export const dynamic = "force-dynamic";

// GET /api/mobile/settings  →  { account, notifications, privacy }
//   account:       { email, emailVerified, username, memberSince, hasPassword } (no password = signs in with Google)
//   notifications: the website's switches (email on/off and each kind of notification)
//   privacy:       { visibility, messagePermission, searchableByRecruiters, privateBrowsing, showConnections }
export async function GET(req: Request) {
  const session = await getMobileSession(req);
  if (!session) return mobileError(401, "UNAUTHORIZED", "Sign in first.");
  const userId = session.user.id;
  const [user, credential, notifications, privacy] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true, emailVerified: true, username: true, createdAt: true } }),
    db.account.findFirst({ where: { userId, providerId: "credential" }, select: { id: true } }),
    getNotificationSettings(userId),
    getPrivacySettings(userId),
  ]);
  return NextResponse.json(
    {
      account: { email: user.email, emailVerified: user.emailVerified, username: user.username, memberSince: user.createdAt, hasPassword: !!credential },
      notifications,
      privacy,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
