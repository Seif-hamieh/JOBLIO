import { getI18n, pageTitle } from "@/i18n/server";
import { MessageSquare } from "lucide-react";
import { requireViewer } from "@/server/session";
import { db } from "@/server/db";
import { directKey, getThread, listConversations } from "@/server/services/messaging";
import { canMessageUser } from "@/server/services/profile";
import { isOnline } from "@/server/realtime";
import { ConversationList } from "@/components/messages/conversation-list";
import { Thread } from "@/components/messages/thread";
import { EmptyState } from "@/components/ui/misc";
import { cn } from "@/lib/utils";

export const generateMetadata = pageTitle("nav.messages");

function loadRecipient(id: string) {
  return db.user.findUnique({
    where: { id },
    select: { id: true, name: true, image: true, username: true, lastSeenAt: true, profile: { select: { headline: true } } },
  });
}

export default async function MessagesPage({ searchParams }: PageProps<"/messages">) {
  const [viewer, { t }] = await Promise.all([requireViewer(), getI18n()]);
  const sp = await searchParams;
  const c = typeof sp.c === "string" ? sp.c : null;
  const to = typeof sp.to === "string" ? sp.to : null;
  const jobParam = typeof sp.job === "string" ? sp.job : null;

  const conversations = await listConversations(viewer.id);

  let thread: Awaited<ReturnType<typeof getThread>> = null;
  let draftRecipient: Awaited<ReturnType<typeof loadRecipient>> = null;
  let blockedReason: string | null = null;

  if (c) thread = await getThread(c, viewer.id);
  else if (to && to !== viewer.id) {
    const existing = await db.conversation.findUnique({ where: { directKey: directKey(viewer.id, to) }, select: { id: true } });
    if (existing) thread = await getThread(existing.id, viewer.id);
    else {
      draftRecipient = await loadRecipient(to);
      if (draftRecipient && !(await canMessageUser({ id: viewer.id, isRecruiter: !!viewer.company }, to))) {
        blockedReason = t("messages.onlyConnections", { name: draftRecipient.name });
      }
    }
  }
  const share = jobParam ? await db.job.findFirst({ where: { id: jobParam, status: "OPEN" }, select: { id: true, title: true } }) : null;
  const activeId = thread?.id ?? null;
  const showThread = !!thread || !!draftRecipient;

  return (
    <div className="surface -mx-4 grid h-[calc(100dvh-8.5rem)] overflow-hidden rounded-none border-x-0 sm:mx-0 sm:rounded-[1.125rem] sm:border-x md:h-[calc(100dvh-8rem)] md:grid-cols-[320px_1fr]">
      <aside className={cn("min-h-0 border-e border-border", showThread && "hidden md:block")}>
        <div className="flex items-center justify-between px-4 pb-1 pt-4">
          <h1 className="font-display text-lg font-semibold">{t("messages.title")}</h1>
        </div>
        <div className="h-[calc(100%-3rem)]">
          <ConversationList conversations={conversations} activeId={activeId} viewerId={viewer.id} />
        </div>
      </aside>
      <section className={cn("min-h-0", !showThread && "hidden md:block")}>
        {thread ? (
          <Thread
            key={thread.id}
            viewerId={viewer.id}
            conversationId={thread.id}
            other={thread.other}
            initialMessages={thread.messages}
            otherLastReadAt={thread.otherLastReadAt}
            initialOnline={thread.online}
            initialShare={share ? { kind: "job", id: share.id, title: share.title } : null}
          />
        ) : draftRecipient ? (
          blockedReason ? (
            <div className="grid h-full place-items-center p-6">
              <EmptyState icon={<MessageSquare />} title={t("messages.cantYet")} description={blockedReason} />
            </div>
          ) : (
            <Thread
              key={`draft-${draftRecipient.id}`}
              viewerId={viewer.id}
              conversationId={null}
              other={draftRecipient}
              initialMessages={[]}
              otherLastReadAt={null}
              initialOnline={isOnline(draftRecipient.id)}
              initialShare={share ? { kind: "job", id: share.id, title: share.title } : null}
            />
          )
        ) : (
          <div className="grid h-full place-items-center p-6">
            <EmptyState icon={<MessageSquare />} title={t("messages.emptyTitle")} description={t("messages.emptyBody")} />
          </div>
        )}
      </section>
    </div>
  );
}
