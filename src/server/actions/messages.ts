"use server";

import { z } from "zod";
import { db } from "@/server/db";
import { ActionError, fail, withViewer, type ActionState } from "@/server/action";
import { LIMITS } from "@/server/rate-limit";
import { publish } from "@/server/realtime";
import { chatMedia, chatMediaSchema, ensureConversation, getThread, markConversationRead, messageSelect, sendMessage, type ChatMessage } from "@/server/services/messaging";
import { deleteStored, storeUpload, UploadError } from "@/server/storage";
import { publicCompanyWhere } from "@/server/services/companies";

const id = z.string().min(1).max(64);

export async function sendMessageAction(form: FormData): Promise<ActionState<{ message: ChatMessage; conversationId: string }>> {
  return withViewer<{ message: ChatMessage; conversationId: string }>({ limit: LIMITS.message }, async (viewer) => {
    const conversationIdRaw = form.get("conversationId");
    const recipientId = form.get("recipientId");
    const body = z.string().trim().max(5000, "@v.messageLength").safeParse(form.get("body") ?? "");
    if (!body.success) return fail(body.error.issues[0]!.message);
    const share = {
      sharedJobId: (form.get("sharedJobId") as string) || null,
      sharedUserId: (form.get("sharedUserId") as string) || null,
      sharedCompanyId: (form.get("sharedCompanyId") as string) || null,
    };
    const file = form.get("file");
    const hasFile = file instanceof File && file.size > 0;
    // A large file uploaded first to /api/v1/chat-upload, or a location.
    const media = chatMediaSchema.safeParse({
      attachmentUrl: form.get("attachmentUrl") || undefined,
      attachmentName: form.get("attachmentName") || undefined,
      latitude: form.get("latitude") || undefined,
      longitude: form.get("longitude") || undefined,
    });
    if (!media.success) return fail("@msg.writeMessage");
    const hasMedia = !!media.data.attachmentUrl || media.data.latitude !== undefined;
    if (!body.data && !hasFile && !hasMedia && !share.sharedJobId && !share.sharedUserId && !share.sharedCompanyId) return fail("@msg.writeMessage");

    const conversationId = conversationIdRaw
      ? id.parse(conversationIdRaw)
      : await ensureConversation({ id: viewer.id, isRecruiter: !!viewer.company, recruiterPro: viewer.recruiterPro }, id.parse(recipientId));

    let attachment = null;
    if (hasFile) {
      // Membership is checked again inside sendMessage before anything is visible.
      const member = await db.conversationParticipant.findUnique({ where: { conversationId_userId: { conversationId, userId: viewer.id } } });
      if (!member) return fail("@msg.convNotFound");
      try {
        const stored = await storeUpload(file as File, "message", conversationId);
        attachment = { url: stored.url, name: stored.name, size: stored.size, mime: stored.mime };
      } catch (e) {
        if (e instanceof UploadError) return fail(e.message);
        throw e;
      }
    }
    if (!attachment && hasMedia) {
      try {
        const m = await chatMedia(conversationId, media.data);
        if (m) {
          const message = await sendMessage({ id: viewer.id, name: viewer.name }, conversationId, { body: body.data, ...m });
          return { ok: true, data: { message, conversationId } };
        }
      } catch (e) {
        if (e instanceof ActionError) return fail(e.message);
        throw e;
      }
    }
    const kind = attachment ? (attachment.mime.startsWith("image/") ? "IMAGE" : "FILE") : share.sharedJobId ? "JOB" : share.sharedUserId ? "PROFILE" : share.sharedCompanyId ? "COMPANY" : "TEXT";
    const message = await sendMessage({ id: viewer.id, name: viewer.name }, conversationId, { body: body.data, kind, attachment, ...share });
    return { ok: true, data: { message, conversationId } };
  });
}

/** Deletes one of your own messages for everyone in the conversation (and its attachment). */
export async function deleteMessageAction(messageId: string): Promise<ActionState> {
  return withViewer({ limit: LIMITS.write }, async (viewer) => {
    const msg = await db.message.findFirst({
      where: { id: id.parse(messageId), senderId: viewer.id },
      select: { id: true, conversationId: true, attachmentUrl: true, conversation: { select: { participants: { select: { userId: true } } } } },
    });
    if (!msg) return fail("@msg.messageNotFound");
    await db.message.delete({ where: { id: msg.id } });
    await deleteStored([msg.attachmentUrl]);
    for (const p of msg.conversation.participants) {
      if (p.userId !== viewer.id) publish(p.userId, { type: "message-deleted", conversationId: msg.conversationId, messageId: msg.id });
    }
    return { ok: true, message: "@msg.messageDeleted" };
  });
}

export async function fetchMessageAction(conversationId: string, messageId: string): Promise<ChatMessage | null> {
  const res = await withViewer<ChatMessage>({}, async (viewer) => {
    const member = await db.conversationParticipant.findUnique({ where: { conversationId_userId: { conversationId: id.parse(conversationId), userId: viewer.id } } });
    if (!member) return fail("@msg.notFound");
    const m = await db.message.findFirst({ where: { id: id.parse(messageId), conversationId }, select: messageSelect });
    return m ? { ok: true, data: m } : fail("@msg.notFound");
  });
  return res?.ok ? (res.data ?? null) : null;
}

export async function loadOlderMessagesAction(conversationId: string, before: string): Promise<ChatMessage[]> {
  const res = await withViewer<ChatMessage[]>({ limit: LIMITS.search }, async (viewer) => {
    const thread = await getThread(id.parse(conversationId), viewer.id, { before: new Date(before), take: 40 });
    return thread ? { ok: true, data: thread.messages } : fail("@msg.notFound");
  });
  return res?.ok ? (res.data ?? []) : [];
}

export async function markReadAction(conversationId: string): Promise<ActionState> {
  return withViewer({}, async (viewer) => {
    await markConversationRead(id.parse(conversationId), viewer.id);
    return { ok: true };
  });
}

export async function typingAction(conversationId: string): Promise<void> {
  await withViewer({ limit: { key: "typing", max: 30, windowMs: 60_000 } }, async (viewer) => {
    const cid = id.parse(conversationId);
    const parts = await db.conversationParticipant.findMany({ where: { conversationId: cid }, select: { userId: true } });
    if (!parts.some((p) => p.userId === viewer.id)) return fail("@msg.notFound");
    for (const p of parts) if (p.userId !== viewer.id) publish(p.userId, { type: "typing", conversationId: cid, userId: viewer.id });
    return { ok: true };
  });
}

export async function archiveConversationAction(conversationId: string): Promise<ActionState> {
  return withViewer({ limit: LIMITS.write }, async (viewer) => {
    await db.conversationParticipant.updateMany({ where: { conversationId: id.parse(conversationId), userId: viewer.id }, data: { archivedAt: new Date() } });
    return { ok: true, message: "@msg.archived" };
  });
}

/** Search for things to share in a message: open jobs, people, companies. */
export async function shareSearchAction(kind: "job" | "person" | "company", q: string) {
  const res = await withViewer<{ id: string; title: string; subtitle: string | null }[]>({ limit: LIMITS.search }, async (viewer) => {
    const term = z.string().trim().max(60).parse(q);
    const contains = { contains: term, mode: "insensitive" as const };
    if (kind === "job") {
      const jobs = await db.job.findMany({ where: { status: "OPEN", ...(term && { OR: [{ title: contains }, { company: { name: contains } }] }) }, take: 8, orderBy: { publishedAt: "desc" }, select: { id: true, title: true, company: { select: { name: true } } } });
      return { ok: true, data: jobs.map((j) => ({ id: j.id, title: j.title, subtitle: j.company.name })) };
    }
    if (kind === "company") {
      const cs = await db.company.findMany({ where: { AND: [term ? { name: contains } : {}, publicCompanyWhere] }, take: 8, orderBy: { followerCount: "desc" }, select: { id: true, name: true, tagline: true } });
      return { ok: true, data: cs.map((c) => ({ id: c.id, title: c.name, subtitle: c.tagline })) };
    }
    const people = await db.user.findMany({
      where: { id: { not: viewer.id }, profile: { visibility: { not: "CONNECTIONS" } }, ...(term && { name: contains }) },
      take: 8,
      select: { id: true, name: true, profile: { select: { headline: true } } },
    });
    return { ok: true, data: people.map((p) => ({ id: p.id, title: p.name, subtitle: p.profile?.headline ?? null })) };
  });
  return res?.ok ? (res.data ?? []) : [];
}
