import "server-only";
import { db } from "@/server/db";
import type { ChatMessage, ConversationSummary } from "@/server/services/messaging";

// What the mobile API returns for conversations and messages (explicit fields, as in dto.ts).

type Other = ConversationSummary["other"];

export function toOther(u: Other) {
  return { id: u.id, name: u.name, image: u.image, username: u.username, headline: u.profile?.headline ?? null };
}

export function toConversation(c: ConversationSummary, userId: string) {
  const last = c.lastMessage;
  return {
    id: c.id,
    other: toOther(c.other),
    lastMessage: last
      ? { body: last.body, kind: last.kind, attachmentName: last.attachmentName, mine: last.senderId === userId, at: last.createdAt.toISOString() }
      : null,
    lastMessageAt: c.lastMessageAt.toISOString(),
    unread: c.unread,
  };
}

export function toMessage(m: ChatMessage, userId: string) {
  return {
    id: m.id,
    mine: m.senderId === userId,
    kind: m.kind,
    body: m.body,
    at: m.createdAt.toISOString(),
    // Files, and jobs / people / companies shared from the website, shown as simple cards in the app.
    attachment: m.attachmentName ? { name: m.attachmentName, size: m.attachmentSize, mime: m.attachmentMime } : null,
    job: m.sharedJob ? { id: m.sharedJob.id, title: m.sharedJob.title, company: m.sharedJob.company.name } : null,
    person: m.sharedUser ? { name: m.sharedUser.name, username: m.sharedUser.username, headline: m.sharedUser.profile?.headline ?? null } : null,
    company: m.sharedCompany ? { slug: m.sharedCompany.slug, name: m.sharedCompany.name } : null,
  };
}

/** Recruiter Pro raises the monthly limit on new conversations with people you aren't connected to. */
export async function hasRecruiterPro(userId: string) {
  return !!(await db.subscription.findFirst({
    where: { userId, product: "RECRUITER_PRO", status: { in: ["ACTIVE", "TRIALING"] }, currentPeriodEnd: { gt: new Date() } },
    select: { id: true },
  }));
}
