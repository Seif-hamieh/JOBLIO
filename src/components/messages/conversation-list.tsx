"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Paperclip, Search } from "lucide-react";
import type { ConversationSummary } from "@/server/services/messaging";
import { useRealtime, useRealtimeEvent } from "@/components/realtime/realtime-provider";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/client";

export function ConversationList({ conversations, activeId, viewerId }: { conversations: ConversationSummary[]; activeId: string | null; viewerId: string }) {
  const router = useRouter();
  const { t, f } = useI18n();
  const [q, setQ] = useState("");
  const { online } = useRealtime();
  const [presence, setPresence] = useState<Record<string, boolean>>({});
  useRealtimeEvent((e) => {
    if (e.type === "presence") setPresence((p) => ({ ...p, [e.userId]: e.online }));
    if (e.type === "message" && e.conversationId !== activeId) router.refresh();
  });
  const list = conversations.filter((c) => !q || c.other.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border p-3">
        <label className="relative block">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("messages.search")} className="h-10 w-full rounded-full bg-surface-2 ps-9 pe-3 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]" aria-label={t("messages.search")} />
        </label>
      </div>
      <ul className="flex-1 overflow-y-auto p-1.5">
        {list.length === 0 && <li className="p-6 text-center text-sm text-fg-muted">{q ? t("messages.noMatches") : t("messages.none")}</li>}
        {list.map((c) => {
          const isOnline = presence[c.other.id] ?? (online.has(c.other.id) || c.online);
          const preview = c.lastMessage
            ? `${c.lastMessage.senderId === viewerId ? t("messages.you") : ""}${c.lastMessage.body || (c.lastMessage.attachmentName ? `📎 ${c.lastMessage.attachmentName}` : c.lastMessage.kind === "JOB" ? t("messages.sharedJob") : c.lastMessage.kind === "PROFILE" ? t("messages.sharedProfile") : t("messages.sharedCompany"))}`
            : t("messages.hello");
          return (
            <li key={c.id}>
              <Link
                href={`/messages?c=${c.id}`}
                scroll={false}
                className={cn("flex items-center gap-3 rounded-2xl p-2.5 transition-colors", c.id === activeId ? "bg-brand-soft/70" : "hover:bg-surface-2")}
              >
                <Avatar name={c.other.name} src={c.other.image} size="md" online={isOnline} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className={cn("truncate text-sm", c.unread ? "font-semibold" : "font-medium")}>{c.other.name}</span>
                    <span className="shrink-0 text-[11px] text-fg-subtle">{f.shortTimeAgo(c.lastMessageAt)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn("truncate text-xs", c.unread ? "text-fg" : "text-fg-muted")}>
                      {c.lastMessage?.attachmentName && <Paperclip className="me-1 inline size-3" />}
                      {preview}
                    </span>
                    {c.unread && <span className="ms-auto size-2 shrink-0 rounded-full bg-brand" aria-label={t("messages.unread")} />}
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
