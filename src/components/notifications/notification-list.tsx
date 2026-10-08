"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AnimatePresence, m } from "motion/react";
import {
  Award,
  BellRing,
  Briefcase,
  CalendarCheck,
  CheckCheck,
  CreditCard,
  Eye,
  Heart,
  MessageCircle,
  MessageSquare,
  Repeat2,
  ThumbsUp,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/controls";
import { useRealtime, useRealtimeEvent } from "@/components/realtime/realtime-provider";
import { markAllNotificationsReadAction, markNotificationReadAction } from "@/server/actions/notifications";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/client";

export type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  href: string | null;
  readAt: Date | null;
  createdAt: Date;
  actor: { name: string; image: string | null } | null;
};

const ICON: Record<string, { icon: typeof BellRing; tone: string }> = {
  CONNECTION_REQUEST: { icon: UserPlus, tone: "bg-brand-soft text-brand-soft-fg" },
  CONNECTION_ACCEPTED: { icon: UserCheck, tone: "bg-mint-soft text-mint-fg" },
  NEW_MESSAGE: { icon: MessageSquare, tone: "bg-aurora-soft text-aurora-fg" },
  APPLICATION_UPDATE: { icon: Briefcase, tone: "bg-brand-soft text-brand-soft-fg" },
  NEW_APPLICANT: { icon: Users, tone: "bg-mint-soft text-mint-fg" },
  INTERVIEW_INVITATION: { icon: CalendarCheck, tone: "bg-ember-soft text-ember-fg" },
  INTERVIEW_RESPONSE: { icon: CalendarCheck, tone: "bg-ember-soft text-ember-fg" },
  NEW_JOB_FROM_FOLLOWED_COMPANY: { icon: Briefcase, tone: "bg-aurora-soft text-aurora-fg" },
  PROFILE_VIEW: { icon: Eye, tone: "bg-surface-3 text-fg-muted" },
  SKILL_ENDORSEMENT: { icon: ThumbsUp, tone: "bg-brand-soft text-brand-soft-fg" },
  POST_LIKE: { icon: Heart, tone: "bg-danger-soft text-danger-fg" },
  POST_COMMENT: { icon: MessageCircle, tone: "bg-aurora-soft text-aurora-fg" },
  POST_SHARE: { icon: Repeat2, tone: "bg-mint-soft text-mint-fg" },
  ACHIEVEMENT_UNLOCKED: { icon: Award, tone: "bg-ember-soft text-ember-fg" },
  BILLING: { icon: CreditCard, tone: "bg-surface-3 text-fg-muted" },
};

const FILTERS = [
  { key: "all", label: "notifications.all", types: null },
  { key: "jobs", label: "notifications.jobs", types: ["APPLICATION_UPDATE", "NEW_APPLICANT", "INTERVIEW_INVITATION", "INTERVIEW_RESPONSE", "NEW_JOB_FROM_FOLLOWED_COMPANY"] },
  { key: "network", label: "notifications.network", types: ["CONNECTION_REQUEST", "CONNECTION_ACCEPTED", "SKILL_ENDORSEMENT", "PROFILE_VIEW", "NEW_MESSAGE"] },
  { key: "posts", label: "notifications.posts", types: ["POST_LIKE", "POST_COMMENT", "POST_SHARE"] },
] as const;

export function NotificationList({ items }: { items: NotificationItem[] }) {
  const router = useRouter();
  const { t, f } = useI18n();
  const { refreshCounts } = useRealtime();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");
  const [read, setRead] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  useRealtimeEvent((e) => {
    if (e.type === "notification") router.refresh();
  });

  const types = FILTERS.find((x) => x.key === filter)!.types as readonly string[] | null;
  const list = items.filter((n) => !types || types.includes(n.type));
  const today = new Date().toDateString();
  const groups = [
    { label: t("notifications.today"), items: list.filter((n) => new Date(n.createdAt).toDateString() === today) },
    { label: t("notifications.earlier"), items: list.filter((n) => new Date(n.createdAt).toDateString() !== today) },
  ];
  const unreadCount = items.filter((n) => !n.readAt && !read.has(n.id)).length;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((x) => (
            <Chip key={x.key} selected={filter === x.key} onClick={() => setFilter(x.key)}>
              {t(x.label)}
            </Chip>
          ))}
        </div>
        {unreadCount > 0 && (
          <Button
            size="sm"
            variant="ghost"
            loading={pending}
            onClick={() =>
              start(async () => {
                await markAllNotificationsReadAction();
                setRead(new Set(items.map((n) => n.id)));
                refreshCounts();
              })
            }
          >
            <CheckCheck /> {t("notifications.markAll")}
          </Button>
        )}
      </div>

      {list.length === 0 && <p className="py-16 text-center text-sm text-fg-muted">{t("notifications.empty")}</p>}

      {groups.map(
        (g) =>
          g.items.length > 0 && (
            <section key={g.label} className="mt-6">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-fg-subtle">{g.label}</h2>
              <ul className="surface divide-y divide-border overflow-hidden">
                <AnimatePresence initial={false}>
                  {g.items.map((n) => {
                    const unread = !n.readAt && !read.has(n.id);
                    const meta = ICON[n.type] ?? { icon: BellRing, tone: "bg-surface-3 text-fg-muted" };
                    const Icon = meta.icon;
                    return (
                      <m.li key={n.id} layout initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
                        <Link
                          href={n.href ?? "/notifications"}
                          onClick={() => {
                            if (!unread) return;
                            setRead((s) => new Set(s).add(n.id));
                            void markNotificationReadAction(n.id).then(() => refreshCounts());
                          }}
                          className={cn("flex items-start gap-3.5 p-4 transition-colors hover:bg-surface-2", unread && "bg-brand-soft/30")}
                        >
                          <span className="relative">
                            {n.actor ? <Avatar name={n.actor.name} src={n.actor.image} size="md" /> : <span className={cn("grid size-10 place-items-center rounded-full", meta.tone)}><Icon className="size-[18px]" /></span>}
                            {n.actor && (
                              <span className={cn("absolute -bottom-1 -end-1 grid size-5 place-items-center rounded-full ring-2 ring-surface", meta.tone)}>
                                <Icon className="size-3" />
                              </span>
                            )}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className={cn("text-sm", unread ? "font-semibold" : "text-fg")}>{n.title}</p>
                            {n.body && <p className="mt-0.5 line-clamp-2 text-sm text-fg-muted">{n.body}</p>}
                            <p className="mt-1 text-xs text-fg-subtle">{f.timeAgo(n.createdAt)}</p>
                          </div>
                          {unread && <span className="mt-2 size-2 shrink-0 rounded-full bg-brand" aria-label={t("messages.unread")} />}
                        </Link>
                      </m.li>
                    );
                  })}
                </AnimatePresence>
              </ul>
            </section>
          ),
      )}
    </div>
  );
}
