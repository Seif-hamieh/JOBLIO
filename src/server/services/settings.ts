import "server-only";
import { z } from "zod";
import { db } from "@/server/db";
import type { privacySchema } from "@/lib/validation/profile";

// Account settings shared by the website (server actions) and the mobile app (/api/mobile/settings/*): notification
// switches, profile privacy and the member's signed-in devices. Password and email changes go through Better Auth.

export const notificationSchema = z.object({
  emailNotifications: z.boolean(),
  notifyMessages: z.boolean(),
  notifyApplications: z.boolean(),
  notifyNetwork: z.boolean(),
  notifyJobAlerts: z.boolean(),
  notifyPosts: z.boolean(),
  notifyProfileViews: z.boolean(),
});
export type NotificationSettings = z.infer<typeof notificationSchema>;

/** Every switch defaults to on until the member changes it (no settings row yet). */
export async function getNotificationSettings(userId: string): Promise<NotificationSettings> {
  const s = await db.userSettings.findUnique({ where: { userId } });
  return {
    emailNotifications: s?.emailNotifications ?? true,
    notifyMessages: s?.notifyMessages ?? true,
    notifyApplications: s?.notifyApplications ?? true,
    notifyNetwork: s?.notifyNetwork ?? true,
    notifyJobAlerts: s?.notifyJobAlerts ?? true,
    notifyPosts: s?.notifyPosts ?? true,
    notifyProfileViews: s?.notifyProfileViews ?? true,
  };
}

export async function updateNotificationSettings(userId: string, data: NotificationSettings) {
  await db.userSettings.upsert({ where: { userId }, create: { userId, ...data }, update: data });
}

const privacySelect = { visibility: true, messagePermission: true, searchableByRecruiters: true, privateBrowsing: true, showConnections: true } as const;

export async function getPrivacySettings(userId: string) {
  return db.profile.findUnique({ where: { userId }, select: privacySelect });
}

export async function updatePrivacySettings(userId: string, data: z.infer<typeof privacySchema>) {
  return db.profile.update({ where: { userId }, data, select: privacySelect });
}

/** The member's signed-in devices that haven't expired, newest activity first. */
export async function listSessions(userId: string) {
  return db.session.findMany({
    where: { userId, expiresAt: { gt: new Date() } },
    orderBy: { updatedAt: "desc" },
    select: { id: true, createdAt: true, updatedAt: true, userAgent: true, ipAddress: true },
  });
}

/** Signs out one of the member's own devices (never the one making the request). */
export async function revokeSession(userId: string, sessionId: string, currentSessionId: string) {
  if (sessionId === currentSessionId) return 0;
  return (await db.session.deleteMany({ where: { id: sessionId, userId } })).count;
}

/** Signs out every device except the one making the request. */
export async function revokeOtherSessions(userId: string, currentSessionId: string) {
  return (await db.session.deleteMany({ where: { userId, id: { not: currentSessionId } } })).count;
}
