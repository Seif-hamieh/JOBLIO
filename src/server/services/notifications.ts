import "server-only";
import { db } from "@/server/db";
import { publish, isOnline } from "@/server/realtime";
import { escapeHtml, sendEmail } from "@/server/mail";
import { absoluteUrl } from "@/lib/utils";
import { decodeMessage, k, translateKey } from "@/i18n/message";
import { createT } from "@/i18n/translate";
import { isLocale } from "@/i18n/config";
import type { Prisma } from "@/generated/prisma/client";
import type { NotificationType } from "@/generated/prisma/enums";

type SettingKey =
  | "notifyMessages"
  | "notifyApplications"
  | "notifyNetwork"
  | "notifyJobAlerts"
  | "notifyPosts"
  | "notifyProfileViews";

const SETTING_FOR: Record<NotificationType, SettingKey | null> = {
  CONNECTION_REQUEST: "notifyNetwork",
  CONNECTION_ACCEPTED: "notifyNetwork",
  NEW_MESSAGE: "notifyMessages",
  APPLICATION_UPDATE: "notifyApplications",
  NEW_APPLICANT: "notifyApplications",
  INTERVIEW_INVITATION: "notifyApplications",
  INTERVIEW_RESPONSE: "notifyApplications",
  NEW_JOB_FROM_FOLLOWED_COMPANY: "notifyJobAlerts",
  PROFILE_VIEW: "notifyProfileViews",
  SKILL_ENDORSEMENT: "notifyNetwork",
  POST_LIKE: "notifyPosts",
  POST_COMMENT: "notifyPosts",
  POST_SHARE: "notifyPosts",
  ACHIEVEMENT_UNLOCKED: null,
  BILLING: null,
};

/** Notification types important enough to also email (when email notifications are on). */
const EMAILED: NotificationType[] = ["APPLICATION_UPDATE", "INTERVIEW_INVITATION"];

const enT = createT("en");

export type NotifyInput = {
  userId: string;
  type: NotificationType;
  /** An encoded key from `k()` (preferred, rendered in each reader's language) or plain text. */
  title: string;
  /** Encoded key or user-generated text (a post excerpt, a connection note). */
  body?: string;
  href?: string;
  actorId?: string | null;
};

/** Stored notification → text in the reader's language. */
export function renderNotification(
  t: ReturnType<typeof createT>,
  n: { title: string; body: string | null; titleKey: string | null; bodyKey: string | null; vars: Prisma.JsonValue },
) {
  const vars = (n.vars && typeof n.vars === "object" && !Array.isArray(n.vars) ? n.vars : null) as Record<string, string | number> | null;
  return {
    title: n.titleKey ? translateKey(t, n.titleKey, vars) : n.title,
    body: n.bodyKey ? translateKey(t, n.bodyKey, vars) : n.body,
  };
}

export async function notify(input: NotifyInput) {
  if (input.actorId && input.actorId === input.userId) return null;
  const settings = await db.userSettings.findUnique({ where: { userId: input.userId } });
  const key = SETTING_FOR[input.type];
  if (settings && key && !settings[key]) return null;

  const title = decodeMessage(input.title);
  const body = input.body ? decodeMessage(input.body) : null;
  const vars = title || body ? { ...title?.vars, ...body?.vars } : undefined;
  const stored = {
    titleKey: title?.key ?? null,
    bodyKey: body?.key ?? null,
    vars: vars && Object.keys(vars).length ? vars : undefined,
    // English copies keep the row readable without the dictionaries (exports, admin tools).
    title: title ? translateKey(enT, title.key, title.vars) : input.title,
    body: body ? translateKey(enT, body.key, vars) : input.body,
  };

  const n = await db.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      ...stored,
      href: input.href,
      actorId: input.actorId ?? null,
    },
  });

  const locale = settings && isLocale(settings.locale) ? settings.locale : "en";
  const t = createT(locale);
  const text = renderNotification(t, { ...stored, body: stored.body ?? null, vars: stored.vars ?? null });
  publish(input.userId, { type: "notification", id: n.id, title: text.title, href: n.href });

  if (EMAILED.includes(input.type) && (settings?.emailNotifications ?? true)) {
    const user = await db.user.findUnique({ where: { id: input.userId }, select: { email: true, name: true } });
    if (user) {
      const link = input.href ? absoluteUrl(input.href) : absoluteUrl("/notifications");
      const dir = locale === "ar" ? "rtl" : "ltr";
      void sendEmail({
        to: user.email,
        subject: text.title,
        text: `${t("email.hi", { name: user.name })}\n\n${text.title}${text.body ? `\n${text.body}` : ""}\n\n${link}`,
        html: `<div dir="${dir}"><p>${escapeHtml(t("email.hi", { name: user.name }))}</p><p><strong>${escapeHtml(text.title)}</strong></p>${
          text.body ? `<p>${escapeHtml(text.body)}</p>` : ""
        }<p><a href="${escapeHtml(link)}">${escapeHtml(t("email.open"))}</a></p></div>`,
      }).catch((e) => console.error("[notify email]", e));
    }
  }
  return n;
}

/**
 * New-message notifications are coalesced: only when the recipient is offline,
 * and at most one unread message notification per sender.
 */
export async function notifyNewMessage(recipientId: string, senderId: string, senderName: string, conversationId: string) {
  if (isOnline(recipientId)) return;
  const existing = await db.notification.findFirst({
    where: { userId: recipientId, actorId: senderId, type: "NEW_MESSAGE", readAt: null },
    select: { id: true },
  });
  if (existing) return;
  await notify({
    userId: recipientId,
    actorId: senderId,
    type: "NEW_MESSAGE",
    title: k("notif.newMessage", { name: senderName }),
    href: `/messages?c=${conversationId}`,
  });
}

export async function unreadNotificationCount(userId: string) {
  return db.notification.count({ where: { userId, readAt: null } });
}
