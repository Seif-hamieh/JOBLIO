"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";
import { AnimatePresence, m } from "motion/react";
import { ArrowLeft, Briefcase, Building2, CheckCheck, Check, FileText, MoreHorizontal, Paperclip, Plus, SendHorizontal, Trash2, UserRound, X } from "lucide-react";
import type { ChatMessage } from "@/server/services/messaging";
import { deleteMessageAction, fetchMessageAction, loadOlderMessagesAction, markReadAction, sendMessageAction, shareSearchAction, typingAction } from "@/server/actions/messages";
import { useRealtime, useRealtimeEvent } from "@/components/realtime/realtime-provider";
import { Avatar, CompanyLogo } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/menu";
import { OpenToWorkBadge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";
import { LocalTime } from "@/components/ui/local-time";
import { cn } from "@/lib/utils";
import { acceptFor, checkUpload } from "@/lib/upload-check";
import { useI18n } from "@/i18n/client";
import type { Format } from "@/i18n/format";
import type { T } from "@/i18n/translate";

type Other = { id: string; name: string; image: string | null; username: string | null; lastSeenAt: Date | null; profile: { headline: string | null } | null };
type Share = { kind: "job" | "person" | "company"; id: string; title: string };

function dayLabel(d: Date, t: T, f: Format) {
  const today = new Date();
  const y = new Date(Date.now() - 86_400_000);
  if (d.toDateString() === today.toDateString()) return t("messages.today");
  if (d.toDateString() === y.toDateString()) return t("messages.yesterday");
  return f.date(d, { weekday: "long", month: "short", day: "numeric" });
}

function formatBytes(n: number | null) {
  if (!n) return "";
  return n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`;
}

function Bubble({ m: msg, mine, onDelete }: { m: ChatMessage; mine: boolean; onDelete?: () => void }) {
  const { t } = useI18n();
  const isImage = msg.attachmentMime?.startsWith("image/");
  return (
    <div className={cn("group/bubble flex max-w-[78%] items-start gap-1", mine ? "flex-row-reverse self-end" : "self-start")}>
      <div className={cn("flex min-w-0 flex-col gap-1.5", mine ? "items-end" : "items-start")}>
      {msg.attachmentUrl &&
        (isImage ? (
          <a href={msg.attachmentUrl} target="_blank" rel="noopener noreferrer" className="overflow-hidden rounded-2xl border border-border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={msg.attachmentUrl} alt={msg.attachmentName ?? ""} className="max-h-72 object-cover" loading="lazy" />
          </a>
        ) : (
          <a href={msg.attachmentUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3 hover:border-brand/40">
            <span className="grid size-10 place-items-center rounded-xl bg-brand-soft text-brand-soft-fg">
              <FileText className="size-5" />
            </span>
            <span className="min-w-0">
              <span className="block max-w-[220px] truncate text-sm font-medium">{msg.attachmentName}</span>
              <span className="text-xs text-fg-subtle">{formatBytes(msg.attachmentSize)}</span>
            </span>
          </a>
        ))}
      {msg.sharedJob && (
        <Link href={`/jobs/${msg.sharedJob.id}`} className="flex w-72 items-center gap-3 rounded-2xl border border-border bg-surface p-3 hover:border-brand/40">
          <CompanyLogo name={msg.sharedJob.company.name} src={msg.sharedJob.company.logoUrl} color={msg.sharedJob.company.brandColor} size="sm" />
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">{msg.sharedJob.title}</span>
            <span className="block truncate text-xs text-fg-muted">{msg.sharedJob.company.name}</span>
          </span>
        </Link>
      )}
      {msg.sharedUser && (
        <Link href={`/in/${msg.sharedUser.username}`} className="flex w-72 items-center gap-3 rounded-2xl border border-border bg-surface p-3 hover:border-brand/40">
          <Avatar name={msg.sharedUser.name} src={msg.sharedUser.image} size="md" />
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">{msg.sharedUser.name}</span>
            <span className="block truncate text-xs text-fg-muted">{msg.sharedUser.profile?.headline}</span>
            {msg.sharedUser.profile?.openToWork && <OpenToWorkBadge className="mt-1 scale-90 origin-[inline-start]" />}
          </span>
        </Link>
      )}
      {msg.sharedCompany && (
        <Link href={`/companies/${msg.sharedCompany.slug}`} className="flex w-72 items-center gap-3 rounded-2xl border border-border bg-surface p-3 hover:border-brand/40">
          <CompanyLogo name={msg.sharedCompany.name} src={msg.sharedCompany.logoUrl} color={msg.sharedCompany.brandColor} size="sm" />
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">{msg.sharedCompany.name}</span>
            <span className="block truncate text-xs text-fg-muted">{msg.sharedCompany.tagline}</span>
          </span>
        </Link>
      )}
      {msg.body && (
        <div dir="auto" className={cn("whitespace-pre-line break-words rounded-3xl px-4 py-2.5 text-[14.5px] leading-relaxed", mine ? "rounded-ee-lg bg-brand text-brand-fg" : "rounded-es-lg bg-surface-2")}>
          {msg.body}
        </div>
      )}
      </div>
      {onDelete && (
        <Menu>
          <MenuTrigger
            className="mt-1.5 grid size-7 shrink-0 place-items-center rounded-full text-fg-subtle opacity-60 outline-none transition hover:bg-surface-2 hover:text-fg focus-visible:opacity-100 md:opacity-0 md:group-hover/bubble:opacity-100"
            aria-label={t("messages.messageOptions")}
          >
            <MoreHorizontal className="size-4" />
          </MenuTrigger>
          <MenuContent align="end">
            <MenuItem icon={<Trash2 />} danger onSelect={onDelete}>
              {t("common.delete")}
            </MenuItem>
          </MenuContent>
        </Menu>
      )}
    </div>
  );
}

function SharePicker({ kind, onPick, onClose }: { kind: Share["kind"] | null; onPick: (s: Share) => void; onClose: () => void }) {
  const { t } = useI18n();
  const [q, setQ] = useState("");
  const [items, setItems] = useState<{ id: string; title: string; subtitle: string | null }[]>([]);
  useEffect(() => {
    if (!kind) return;
    let alive = true;
    const timer = setTimeout(() => void shareSearchAction(kind, q).then((r) => alive && setItems(r)), 150);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [kind, q]);
  return (
    <Dialog open={!!kind} onOpenChange={(o) => !o && onClose()} size="sm" title={kind === "job" ? t("messages.shareJob") : kind === "person" ? t("messages.shareProfile") : t("messages.shareCompany")}>
      <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("common.search")} className="h-11 w-full rounded-xl border border-border bg-surface px-3.5 text-sm outline-none focus:border-brand" />
      <ul className="mt-3 max-h-80 space-y-1 overflow-y-auto">
        {items.map((it) => (
          <li key={it.id}>
            <button type="button" onClick={() => onPick({ kind: kind!, id: it.id, title: it.title })} className="w-full rounded-xl p-2.5 text-start hover:bg-surface-2">
              <div className="text-sm font-medium">{it.title}</div>
              {it.subtitle && <div className="truncate text-xs text-fg-muted">{it.subtitle}</div>}
            </button>
          </li>
        ))}
      </ul>
    </Dialog>
  );
}

export function Thread({
  viewerId,
  conversationId: initialConversationId,
  other,
  initialMessages,
  otherLastReadAt: initialRead,
  initialOnline,
  initialShare,
}: {
  viewerId: string;
  conversationId: string | null;
  other: Other;
  initialMessages: ChatMessage[];
  otherLastReadAt: Date | null;
  initialOnline: boolean;
  initialShare?: Share | null;
}) {
  const router = useRouter();
  const { t, f } = useI18n();
  const { refreshCounts } = useRealtime();
  const [conversationId, setConversationId] = useState(initialConversationId);
  const [messages, setMessages] = useState(initialMessages);
  const [otherRead, setOtherRead] = useState<Date | null>(initialRead ? new Date(initialRead) : null);
  const [online, setOnline] = useState(initialOnline);
  const [typing, setTyping] = useState(false);
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [share, setShare] = useState<Share | null>(initialShare ?? null);
  const [picker, setPicker] = useState<Share["kind"] | null>(null);
  const [hasOlder, setHasOlder] = useState(initialMessages.length >= 50);
  const [pending, start] = useTransition();
  const [deleting, setDeleting] = useState<string | null>(null);
  const [removing, startRemove] = useTransition();
  const removeMessage = () =>
    startRemove(async () => {
      const target = deleting;
      if (!target) return;
      const res = await deleteMessageAction(target).catch(() => null);
      setDeleting(null);
      if (res?.ok) {
        setMessages((list) => list.filter((x) => x.id !== target));
        router.refresh();
      } else toast.error(res && !res.ok ? res.error : t("common.somethingWrong"));
    });
  const scroller = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSent = useRef(0);

  useEffect(() => {
    setMessages(initialMessages);
    setConversationId(initialConversationId);
  }, [initialMessages, initialConversationId]);

  useLayoutEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [messages.length]);

  useEffect(() => {
    if (!conversationId) return;
    void markReadAction(conversationId).then(() => refreshCounts());
  }, [conversationId, refreshCounts]);

  useRealtimeEvent((e) => {
    if (e.type === "presence" && e.userId === other.id) setOnline(e.online);
    if (!conversationId || ("conversationId" in e && e.conversationId !== conversationId)) return;
    if (e.type === "message" && e.senderId !== viewerId) {
      setTyping(false);
      void fetchMessageAction(conversationId, e.messageId).then((msg) => {
        if (msg) setMessages((list) => (list.some((x) => x.id === msg.id) ? list : [...list, msg]));
        void markReadAction(conversationId).then(() => refreshCounts());
      });
    } else if (e.type === "message-deleted" && e.conversationId === conversationId) {
      setMessages((list) => list.filter((x) => x.id !== e.messageId));
    } else if (e.type === "read" && e.userId === other.id) setOtherRead(new Date(e.at));
    else if (e.type === "typing" && e.userId === other.id) {
      setTyping(true);
      if (typingTimer.current) clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => setTyping(false), 3500);
    }
  });

  function pickAttachment(input: HTMLInputElement) {
    const picked = input.files?.[0] ?? null;
    input.value = "";
    const problem = picked && checkUpload(picked, "attachment", t);
    if (problem) return toast.error(problem);
    setFile(picked);
  }

  function send() {
    if (!body.trim() && !file && !share) return;
    const fd = new FormData();
    if (conversationId) fd.set("conversationId", conversationId);
    else fd.set("recipientId", other.id);
    fd.set("body", body.trim());
    if (file) fd.set("file", file);
    if (share?.kind === "job") fd.set("sharedJobId", share.id);
    if (share?.kind === "person") fd.set("sharedUserId", share.id);
    if (share?.kind === "company") fd.set("sharedCompanyId", share.id);
    const draft = body;
    setBody("");
    start(async () => {
      const res = await sendMessageAction(fd).catch(() => null);
      if (res?.ok && res.data) {
        setMessages((list) => [...list, res.data!.message]);
        setFile(null);
        setShare(null);
        if (!conversationId) {
          setConversationId(res.data.conversationId);
          router.replace(`/messages?c=${res.data.conversationId}`, { scroll: false });
        }
        router.refresh();
      } else {
        setBody(draft);
        toast.error(res && !res.ok ? res.error : t("messages.notSent"));
      }
    });
  }

  const lastMine = [...messages].reverse().find((x) => x.senderId === viewerId);
  const seen = !!lastMine && !!otherRead && otherRead >= new Date(lastMine.createdAt);

  return (
    <div className="flex h-full flex-col">
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={t("messages.deleteTitle")}
        description={t("messages.deleteBody")}
        confirmLabel={t("common.delete")}
        onConfirm={removeMessage}
        loading={removing}
      />
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <Link href="/messages" className="rounded-full p-1.5 text-fg-muted hover:bg-surface-2 md:hidden" aria-label={t("messages.back")}>
          <ArrowLeft className="size-5" />
        </Link>
        <Link href={`/in/${other.username}`} className="flex min-w-0 flex-1 items-center gap-3">
          <Avatar name={other.name} src={other.image} size="md" online={online} />
          <div className="min-w-0">
            <div className="truncate font-semibold">{other.name}</div>
            <div className="truncate text-xs text-fg-muted" suppressHydrationWarning>
              {typing ? <span className="text-brand-soft-fg">{t("messages.typing")}</span> : online ? t("messages.online") : other.lastSeenAt ? t("messages.activeAgo", { when: f.timeAgo(other.lastSeenAt) }) : other.profile?.headline}
            </div>
          </div>
        </Link>
      </header>

      <div ref={scroller} className="flex flex-1 flex-col gap-2 overflow-y-auto px-4 py-5" aria-live="polite">
        {hasOlder && conversationId && (
          <button
            className="mx-auto mb-2 rounded-full border border-border px-3 py-1 text-xs text-fg-muted hover:bg-surface-2"
            onClick={async () => {
              const older = await loadOlderMessagesAction(conversationId, new Date(messages[0]!.createdAt).toISOString());
              setHasOlder(older.length >= 40);
              setMessages((list) => [...older, ...list]);
            }}
          >
            {t("messages.loadEarlier")}
          </button>
        )}
        {messages.length === 0 && (
          <div className="m-auto max-w-xs text-center">
            <Avatar name={other.name} src={other.image} size="xl" className="mx-auto" />
            <p className="mt-3 font-semibold">{t("messages.startWith", { name: other.name.split(" ")[0]! })}</p>
            <p className="mt-1 text-sm text-fg-muted">{t("messages.startHint")}</p>
          </div>
        )}
        {messages.map((msg, i) => {
          const d = new Date(msg.createdAt);
          const prev = messages[i - 1];
          const newDay = !prev || new Date(prev.createdAt).toDateString() !== d.toDateString();
          return (
            <Fragment key={msg.id}>
              {newDay && (
                <div className="my-3 self-center rounded-full bg-surface-2 px-3 py-1 text-[11px] font-medium text-fg-muted" suppressHydrationWarning>
                  {dayLabel(d, t, f)}
                </div>
              )}
              <m.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="flex flex-col">
                <Bubble m={msg} mine={msg.senderId === viewerId} onDelete={msg.senderId === viewerId ? () => setDeleting(msg.id) : undefined} />
                <LocalTime date={d} format="time" className={cn("mt-0.5 text-[10px] text-fg-subtle", msg.senderId === viewerId ? "self-end" : "self-start")} />
              </m.div>
            </Fragment>
          );
        })}
        {lastMine && (
          <div className="flex items-center gap-1 self-end text-[11px] text-fg-subtle">
            {seen ? <CheckCheck className="size-3.5 text-brand" /> : <Check className="size-3.5" />} {seen ? t("messages.seen") : t("messages.sent")}
          </div>
        )}
        <AnimatePresence>
          {typing && (
            <m.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex gap-1 self-start rounded-3xl bg-surface-2 px-4 py-3">
              {[0, 1, 2].map((i) => (
                <m.span key={i} className="size-1.5 rounded-full bg-fg-subtle" animate={{ y: [0, -3, 0] }} transition={{ repeat: Infinity, duration: 0.9, delay: i * 0.15 }} />
              ))}
            </m.div>
          )}
        </AnimatePresence>
      </div>

      <div className="border-t border-border p-3">
        {(file || share) && (
          <div className="mb-2 flex flex-wrap gap-2">
            {file && (
              <span className="inline-flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-1.5 text-xs">
                <Paperclip className="size-3.5" /> {file.name}
                <button onClick={() => setFile(null)} aria-label={t("common.remove")}>
                  <X className="size-3.5" />
                </button>
              </span>
            )}
            {share && (
              <span className="inline-flex items-center gap-2 rounded-xl bg-brand-soft px-3 py-1.5 text-xs text-brand-soft-fg">
                {share.kind === "job" ? <Briefcase className="size-3.5" /> : share.kind === "person" ? <UserRound className="size-3.5" /> : <Building2 className="size-3.5" />}
                {share.title}
                <button onClick={() => setShare(null)} aria-label={t("common.remove")}>
                  <X className="size-3.5" />
                </button>
              </span>
            )}
          </div>
        )}
        <div className="flex items-end gap-2">
          <Menu>
            <MenuTrigger className="grid size-10 shrink-0 place-items-center rounded-full text-fg-muted hover:bg-surface-2" aria-label={t("messages.attachOrShare")}>
              <Plus className="size-5" />
            </MenuTrigger>
            <MenuContent align="start" side="top">
              <MenuItem icon={<Paperclip />} onSelect={() => fileRef.current?.click()}>
                {t("messages.attach")}
              </MenuItem>
              <MenuItem icon={<Briefcase />} onSelect={() => setPicker("job")}>
                {t("messages.shareJob")}
              </MenuItem>
              <MenuItem icon={<UserRound />} onSelect={() => setPicker("person")}>
                {t("messages.shareProfile")}
              </MenuItem>
              <MenuItem icon={<Building2 />} onSelect={() => setPicker("company")}>
                {t("messages.shareCompany")}
              </MenuItem>
            </MenuContent>
          </Menu>
          <input ref={fileRef} type="file" className="sr-only" accept={acceptFor("attachment")} onChange={(e) => pickAttachment(e.target)} />
          <textarea
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              if (conversationId && Date.now() - lastTypingSent.current > 2500) {
                lastTypingSent.current = Date.now();
                void typingAction(conversationId);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={1}
            maxLength={5000}
            placeholder={t("messages.placeholder")}
            aria-label={t("common.message")}
            className="max-h-36 min-h-10 flex-1 resize-none rounded-3xl border border-border bg-surface-2 px-4 py-2.5 text-sm outline-none [field-sizing:content] focus:border-brand focus:bg-surface"
          />
          <Button size="icon" pill loading={pending} onClick={send} disabled={!body.trim() && !file && !share} aria-label={t("messages.send")}>
            <SendHorizontal />
          </Button>
        </div>
      </div>
      <SharePicker
        kind={picker}
        onClose={() => setPicker(null)}
        onPick={(s) => {
          setShare(s);
          setPicker(null);
        }}
      />
    </div>
  );
}
