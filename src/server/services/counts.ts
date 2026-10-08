import "server-only";
import { db } from "@/server/db";

export async function unreadConversationCount(userId: string) {
  const rows = await db.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(DISTINCT m."conversationId") AS n
    FROM messages m
    JOIN conversation_participants p ON p."conversationId" = m."conversationId" AND p."userId" = ${userId}
    WHERE m."senderId" <> ${userId}
      AND p."archivedAt" IS NULL
      AND (p."lastReadAt" IS NULL OR m."createdAt" > p."lastReadAt")`;
  return Number(rows[0]?.n ?? 0);
}

export async function getCounts(userId: string) {
  const [notifications, messages, pendingConnections] = await Promise.all([
    db.notification.count({ where: { userId, readAt: null } }),
    unreadConversationCount(userId),
    db.connection.count({ where: { addresseeId: userId, status: "PENDING" } }),
  ]);
  return { notifications, messages, pendingConnections };
}

export type Counts = Awaited<ReturnType<typeof getCounts>>;

/** Everyone who shares a conversation with the user — recipients of presence updates. */
export async function conversationPartnerIds(userId: string) {
  const rows = await db.conversationParticipant.findMany({
    where: { conversation: { participants: { some: { userId } } }, userId: { not: userId } },
    select: { userId: true },
    take: 300,
  });
  return [...new Set(rows.map((r) => r.userId))];
}
