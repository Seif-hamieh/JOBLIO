import { headers } from "next/headers";
import { Laptop, Lock, ShieldCheck, Smartphone } from "lucide-react";
import { getI18n, pageTitle } from "@/i18n/server";
import { requireViewer } from "@/server/session";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, PageHeader } from "@/components/ui/misc";
import { PrivacyForm, RevokeOthersButton, RevokeSessionButton, UnblockButton } from "@/components/settings/settings-forms";
import type { MessagePermission, ProfileVisibility } from "@/lib/constants";

export const generateMetadata = pageTitle("nav.privacy");

/** A short, readable device label from a user-agent string (no third-party parsing). */
function deviceLabel(ua: string | null) {
  if (!ua) return null;
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : null;
  const os = /Windows/.test(ua) ? "Windows" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Mac OS X/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : null;
  return [browser, os].filter(Boolean).join(" · ") || null;
}

export default async function PrivacyPage() {
  const [viewer, { t, f }] = await Promise.all([requireViewer(), getI18n()]);
  const [profile, sessions, current, blocks] = await Promise.all([
    db.profile.findUniqueOrThrow({
      where: { id: viewer.profileId },
      select: { visibility: true, searchableByRecruiters: true, privateBrowsing: true, messagePermission: true, showConnections: true },
    }),
    db.session.findMany({ where: { userId: viewer.id, expiresAt: { gt: new Date() } }, orderBy: { updatedAt: "desc" }, select: { id: true, userAgent: true, ipAddress: true, updatedAt: true } }),
    auth.api.getSession({ headers: await headers() }),
    db.block.findMany({ where: { blockerId: viewer.id }, select: { blocked: { select: { id: true, name: true, image: true, profile: { select: { headline: true } } } } } }),
  ]);
  const currentId = current?.session.id;

  return (
    <div className="space-y-6">
      <PageHeader title={t("privacy.title")} description={t("privacy.sub")} />

      <Card className="p-6 sm:p-7">
        <PrivacyForm
          initial={{
            visibility: profile.visibility as ProfileVisibility,
            searchableByRecruiters: profile.searchableByRecruiters,
            privateBrowsing: profile.privateBrowsing,
            messagePermission: profile.messagePermission as MessagePermission,
            showConnections: profile.showConnections,
          }}
        />
      </Card>

      <Card className="p-6 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <CardHeader title={t("privacy.sessions")} description={t("privacy.sessionsSub")} />
          {sessions.length > 1 && <RevokeOthersButton />}
        </div>
        <ul className="mt-4 divide-y divide-border">
          {sessions.map((s) => {
            const mobile = /Mobile|Android|iPhone/.test(s.userAgent ?? "");
            const Icon = mobile ? Smartphone : Laptop;
            return (
              <li key={s.id} className="flex flex-wrap items-center gap-3 py-3">
                <span className="grid size-10 place-items-center rounded-xl bg-surface-2 text-fg-muted">
                  <Icon className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    {deviceLabel(s.userAgent) ?? t("privacy.unknownDevice")}
                    {s.id === currentId && (
                      <Badge tone="mint" size="xs">
                        {t("privacy.thisDevice")}
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-fg-subtle">
                    {t("privacy.lastActive", { when: f.timeAgo(s.updatedAt) })}
                    {s.ipAddress ? <span dir="ltr"> · {s.ipAddress}</span> : null}
                  </div>
                </div>
                {s.id !== currentId && <RevokeSessionButton sessionId={s.id} />}
              </li>
            );
          })}
        </ul>
      </Card>

      <Card className="p-6 sm:p-7">
        <CardHeader title={t("privacy.blocked")} />
        <ul className="mt-4 space-y-3">
          {blocks.length === 0 && <li className="text-sm text-fg-muted">{t("privacy.noneBlocked")}</li>}
          {blocks.map(({ blocked: u }) => (
            <li key={u.id} className="flex items-center gap-3">
              <Avatar name={u.name} src={u.image} size="md" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{u.name}</div>
                <div className="truncate text-xs text-fg-muted">{u.profile?.headline}</div>
              </div>
              <UnblockButton userId={u.id} />
            </li>
          ))}
        </ul>
      </Card>

      <Card className="p-6 sm:p-7">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
          <ShieldCheck className="size-5 text-mint" /> {t("privacy.security")}
        </h2>
        <ul className="mt-4 space-y-2.5 text-sm text-fg-muted">
          {([1, 2, 3, 4] as const).map((n) => (
            <li key={n} className="flex gap-2.5">
              <Lock className="mt-0.5 size-4 shrink-0 text-fg-subtle" /> {t(`privacy.sec${n}`)}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
