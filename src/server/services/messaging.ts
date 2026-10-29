import "server-only";
import { z } from "zod";
import { db, type Prisma } from "@/server/db";
import { isOnline, publish } from "@/server/realtime";
import { ActionError } from "@/server/action";
import { canMessageUser, isConnected } from "@/server/services/profile";
import { notifyNewMessage } from "@/server/services/notifications";
import { chatKindForMime, safeFileName, statChatFile } from "@/server/storage";

export const directKey = (a: string, b: string) => [a, b].sort().join(":");

const otherUserSelect = { id: true, name: true, image: true, username: true, lastSeenAt: true, profile: { select: { headline: true } } } satisfies Prisma.UserSelect;

export const messageSelect = {
  id: true,
  conversationId: true,
  senderId: true,
  kind: true,
  body: true,
  attachmentUrl: true,
  attachmentName: true,
  attachmentSize: true,
  attachmentMime: true,
  latitude: true,
  longitude: true,
  createdAt: true,
  sharedJob: { select: { id: true, title: true, workMode: true, status: true, company: { select: { name: true, logoUrl: true, brandColor: true } } } },
  sharedUser: { select: { id: true, name: true, image: true, username: true, profile: { select: { headline: true, openToWork: true } } } },
  sharedCompany: { select: { id: true, slug: true, name: true, logoUrl: true, brandColor: true, tagline: true } },
} satisfies Prisma.MessageSelect;

export type ChatMessage = Prisma.MessageGetPayload<{ select: typeof messageSelect }>;

export async function listConversations(userId: string) {
  const parts = await db.conversationParticipant.findMany({
    where: { userId, archivedAt: null },
    orderBy: { conversation: { lastMessageAt: "desc" } },
    take: 100,
    select: {
      lastReadAt: true,
      conversation: {
        select: {
          id: true,
          lastMessageAt: true,
          participants: { where: { userId: { not: userId } }, select: { lastReadAt: true, user: { select: otherUserSelect } } },
          messages: { orderBy: { createdAt: "desc" }, take: 1, select: { body: true, kind: true, senderId: true, createdAt: true, attachmentName: true } },
        },
      },
    },
  });
  return parts
    .filter((p) => p.conversation.participants[0])
    .map((p) => {
      const last = p.conversation.messages[0];
      const other = p.conversation.participants[0]!.user;
      return {
        id: p.conversation.id,
        other,
        online: isOnline(other.id),
        lastMessage: last ?? null,
        lastMessageAt: p.conversation.lastMessageAt,
        unread: !!last && last.senderId !== userId && (!p.lastReadAt || last.createdAt > p.lastReadAt),
      };
    });
}

export type ConversationSummary = Awaited<ReturnType<typeof listConversations>>[number];

export async function getThread(conversationId: string, userId: string, opts: { before?: Date; take?: number } = {}) {
  const me = await db.conversationParticipant.findUnique({ where: { conversationId_userId: { conversationId, userId } } });
  if (!me) return null;
  const [others, messages] = await Promise.all([
    db.conversationParticipant.findMany({ where: { conversationId, userId: { not: userId } }, select: { lastReadAt: true, user: { select: otherUserSelect } } }),
    db.message.findMany({
      where: { conversationId, ...(opts.before && { createdAt: { lt: opts.before } }) },
      orderBy: { createdAt: "desc" },
      take: opts.take ?? 50,
      select: messageSelect,
    }),
  ]);
  const other = others[0];
  if (!other) return null;
  return { id: conversationId, other: other.user, otherLastReadAt: other.lastReadAt, online: isOnline(other.user.id), messages: messages.reverse() };
}

export type SendInput = {
  body: string;
  kind: "TEXT" | "FILE" | "IMAGE" | "AUDIO" | "LOCATION" | "JOB" | "PROFILE" | "COMPANY";
  attachment?: { url: string; name: string; size: number; mime: string } | null;
  location?: { latitude: number; longitude: number } | null;
  sharedJobId?: string | null;
  sharedUserId?: string | null;
  sharedCompanyId?: string | null;
};

/** New conversations a recruiter may open per month with people they aren't connected to. */
export const RECRUITER_CONTACTS = { free: 15, pro: 300 } as const;

/** Finds or creates the 1:1 conversation, enforcing the recipient's message settings. */
export async function ensureConversation(sender: { id: string; isRecruiter: boolean; recruiterPro?: boolean }, recipientId: string) {
  const key = directKey(sender.id, recipientId);
  const existing = await db.conversation.findUnique({ where: { directKey: key }, select: { id: true } });
  if (existing) {
    // Re-open if either side had archived it.
    await db.conversationParticipant.updateMany({ where: { conversationId: existing.id }, data: { archivedAt: null } });
    return existing.id;
  }
  if (!(await canMessageUser(sender, recipientId))) throw new ActionError("@msg.onlyConnections");
  if (sender.isRecruiter && !(await isConnected(sender.id, recipientId))) {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const opened = await db.conversationParticipant.count({ where: { userId: sender.id, joinedAt: { gte: monthStart } } });
    const limit = sender.recruiterPro ? RECRUITER_CONTACTS.pro : RECRUITER_CONTACTS.free;
    if (opened >= limit) {
      throw new ActionError(
        sender.recruiterPro ? "@msg.contactLimitPro" : `@msg.contactLimitFree?{"n":${limit}}`,
      );
    }
  }
  const recipient = await db.user.findUnique({ where: { id: recipientId }, select: { id: true } });
  if (!recipient) throw new ActionError("@msg.memberNotFound");
  try {
    const conv = await db.conversation.create({
      data: { directKey: key, participants: { create: [{ userId: sender.id, lastReadAt: new Date() }, { userId: recipientId }] } },
      select: { id: true },
    });
    return conv.id;
  } catch {
    // Created concurrently — fetch the winner.
    return (await db.conversation.findUniqueOrThrow({ where: { directKey: key }, select: { id: true } })).id;
  }
}

export async function sendMessage(sender: { id: string; name: string }, conversationId: string, input: SendInput) {
  const participants = await db.conversationParticipant.findMany({ where: { conversationId }, select: { userId: true } });
  if (!participants.some((p) => p.userId === sender.id)) throw new ActionError("@msg.convNotFound");
  const recipients = participants.map((p) => p.userId).filter((id) => id !== sender.id);
  for (const r of recipients) {
    const blocked = await db.block.findFirst({ where: { OR: [{ blockerId: r, blockedId: sender.id }, { blockerId: sender.id, blockedId: r }] } });
    if (blocked) throw new ActionError("@msg.cantMessage");
  }

  // Shared entities must exist (and jobs must be open).
  if (input.sharedJobId && !(await db.job.findFirst({ where: { id: input.sharedJobId, status: "OPEN" }, select: { id: true } }))) throw new ActionError("@msg.jobNotFound");
  if (input.sharedUserId && !(await db.user.findUnique({ where: { id: input.sharedUserId }, select: { id: true } }))) throw new ActionError("@msg.profileNotFound");
  if (input.sharedCompanyId && !(await db.company.findUnique({ where: { id: input.sharedCompanyId }, select: { id: true } }))) throw new ActionError("@msg.companyNotFound");

  const now = new Date();
  const [message] = await db.$transaction([
    db.message.create({
      data: {
        conversationId,
        senderId: sender.id,
        kind: input.kind,
        body: input.body,
        attachmentUrl: input.attachment?.url,
        attachmentName: input.attachment?.name,
        attachmentSize: input.attachment?.size,
        attachmentMime: input.attachment?.mime,
        latitude: input.location?.latitude ?? null,
        longitude: input.location?.longitude ?? null,
        sharedJobId: input.sharedJobId ?? null,
        sharedUserId: input.sharedUserId ?? null,
        sharedCompanyId: input.sharedCompanyId ?? null,
        createdAt: now,
      },
      select: messageSelect,
    }),
    db.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: now } }),
    db.conversationParticipant.update({ where: { conversationId_userId: { conversationId, userId: sender.id } }, data: { lastReadAt: now } }),
    db.conversationParticipant.updateMany({ where: { conversationId }, data: { archivedAt: null } }),
  ]);
  for (const r of recipients) {
    publish(r, { type: "message", conversationId, messageId: message.id, senderId: sender.id });
    await notifyNewMessage(r, sender.id, sender.name, conversationId);
  }
  return message;
}

export async function markConversationRead(conversationId: string, userId: string) {
  const now = new Date();
  const updated = await db.conversationParticipant.updateMany({ where: { conversationId, userId }, data: { lastReadAt: now } });
  if (!updated.count) return;
  // Clear the coalesced message notification for this conversation, if any.
  await db.notification.updateMany({ where: { userId, type: "NEW_MESSAGE", href: `/messages?c=${conversationId}`, readAt: null }, data: { readAt: now } });
  const others = await db.conversationParticipant.findMany({ where: { conversationId, userId: { not: userId } }, select: { userId: true } });
  for (const o of others) publish(o.userId, { type: "read", conversationId, userId, at: now.toISOString() });
}

/** What a member can attach to a chat message, besides text and shared jobs / people / companies. */
export const chatMediaSchema = z.object({
  // A file sent first to /api/v1/chat-upload (its url and the name it had on the sender's device)…
  attachmentUrl: z.string().max(300).optional(),
  attachmentName: z.string().trim().max(200).optional(),
  // …or a place on the map.
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
});

/**
 * Turns an uploaded chat file or a location into what sendMessage stores. The file must have been uploaded to this
 * same conversation; its type and size come from the stored file, never from the sender.
 */
export async function chatMedia(conversationId: string, input: z.output<typeof chatMediaSchema>) {
  if (input.attachmentUrl) {
    const file = await statChatFile(input.attachmentUrl, conversationId);
    if (!file) throw new ActionError("@msg.chatFileMissing");
    const name = safeFileName(input.attachmentName || input.attachmentUrl.split("/").pop()!);
    return { kind: chatKindForMime(file.mime), attachment: { url: input.attachmentUrl, name, size: file.size, mime: file.mime }, location: null };
  }
  if (input.latitude !== undefined && input.longitude !== undefined) {
    return { kind: "LOCATION" as const, attachment: null, location: { latitude: input.latitude, longitude: input.longitude } };
  }
  return null;
}
