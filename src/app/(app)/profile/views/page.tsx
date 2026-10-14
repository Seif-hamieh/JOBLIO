import { getI18n, pageTitle } from "@/i18n/server";
import Link from "next/link";
import { EyeOff, Eye, Lock, Rocket } from "lucide-react";
import { requireViewer } from "@/server/session";
import { db } from "@/server/db";
import { Bars } from "@/components/charts/bars";
import { Avatar } from "@/components/ui/avatar";
import { Card, CardHeader, EmptyState, PageHeader, Stat } from "@/components/ui/misc";
import { buttonClasses } from "@/components/ui/button";
import { ClaimFreeBoostButton } from "@/components/billing/claim-free-boost-button";
import { hasJobSeekerPro, isEligibleForFreeBoost } from "@/server/services/subscriptions";

export const generateMetadata = pageTitle("profile.tabViews");

export default async function ProfileViewsPage() {
  const [viewer, { t, f }] = await Promise.all([requireViewer(), getI18n()]);
  const since = new Date(Date.now() - 29 * 86_400_000);
  since.setHours(0, 0, 0, 0);
  const [views, total, prev, freeBoost, isPro] = await Promise.all([
    db.profileView.findMany({
      where: { viewedId: viewer.id, createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        createdAt: true,
        anonymous: true,
        viewer: { select: { name: true, image: true, username: true, profile: { select: { headline: true } }, companyMemberships: { take: 1, select: { company: { select: { name: true } } } } } },
      },
    }),
    db.profile.findUnique({ where: { id: viewer.profileId }, select: { profileViewCount: true } }),
    db.profileView.count({ where: { viewedId: viewer.id, createdAt: { gte: new Date(since.getTime() - 30 * 86_400_000), lt: since } } }),
    isEligibleForFreeBoost(viewer.id),
    hasJobSeekerPro(viewer.id),
  ]);
  const days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(since.getTime() + i * 86_400_000);
    return { key: d.toDateString(), label: f.date(d, { month: "short", day: "numeric", timeZone: "UTC" }), value: 0 };
  });
  for (const v of views) {
    const d = days.find((x) => x.key === new Date(v.createdAt).toDateString());
    if (d) d.value++;
  }
  const recruiters = views.filter((v) => !v.anonymous && v.viewer?.companyMemberships.length).length;
  const change = prev ? Math.round(((views.length - prev) / prev) * 100) : null;
  // Job Seeker Pro sees every recent viewer; everyone else sees the latest 3 (only those are rendered).
  const visible = isPro ? views.slice(0, 40) : views.slice(0, 3);
  const hidden = isPro ? 0 : views.length - visible.length;

  return (
    <div className="space-y-6">
      <PageHeader title={t("profileEdit.viewsTitle")} description={t("profileEdit.viewsSub")} />
      {freeBoost.eligible && (
        <div className="flex flex-wrap items-center gap-4 rounded-2xl bg-ember/10 p-4 ring-1 ring-ember/30">
          <Rocket className="size-6 shrink-0 text-ember-fg" />
          <div className="min-w-0 flex-1">
            <div className="font-semibold">{t("profileEdit.freeBoostTitle")}</div>
            <div className="text-sm text-fg-muted">{t("profileEdit.freeBoostBody")}</div>
          </div>
          <ClaimFreeBoostButton />
        </div>
      )}
      {freeBoost.reason === "too_soon" && freeBoost.nextEligibleAt && (
        <p className="flex items-center gap-1.5 text-xs text-fg-subtle">
          <Rocket className="size-3.5" /> {t("profileEdit.freeBoostTooSoon", { date: f.date(freeBoost.nextEligibleAt, { month: "long", day: "numeric" }) })}
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label={t("profileEdit.views30")} value={views.length} icon={<Eye />} hint={change != null ? t("profileEdit.vsPrev", { pct: `${change >= 0 ? "+" : ""}${change}` }) : undefined} />
        <Stat label={t("profileEdit.fromRecruiters")} value={recruiters} hint={t("profileEdit.recruitersHint")} />
        <Stat label={t("profileEdit.allTime")} value={total?.profileViewCount ?? 0} />
      </div>
      <Card className="p-6">
        <CardHeader title={t("profileEdit.daily")} />
        <Bars data={days.map((d) => ({ label: d.label, value: d.value }))} label={t("home.viewsChart")} height={120} className="mt-5" />
      </Card>
      <Card className="p-6">
        <CardHeader
          title={t("profileEdit.recentViewers")}
          action={
            !viewer.boosted ? (
              <Link href="/premium" className={buttonClasses({ size: "sm", variant: "soft", pill: true })}>
                <Rocket /> {t("profileEdit.getMoreViews")}
              </Link>
            ) : undefined
          }
        />
        {views.length === 0 ? (
          <EmptyState className="mt-4" icon={<Eye />} title={t("profileEdit.noViews")} description={t("profileEdit.noViewsBody")} />
        ) : (
          <ul className="mt-4 divide-y divide-border">
            {visible.map((v) =>
              v.anonymous || !v.viewer ? (
                <li key={v.id} className="flex items-center gap-3 py-3">
                  <span className="grid size-10 place-items-center rounded-full bg-surface-3 text-fg-subtle">
                    <EyeOff className="size-4" />
                  </span>
                  <div className="flex-1 text-sm text-fg-muted">{t("profileEdit.privateViewer")}</div>
                  <span className="text-xs text-fg-subtle">{f.timeAgo(v.createdAt)}</span>
                </li>
              ) : (
                <li key={v.id} className="flex items-center gap-3 py-3">
                  <Avatar name={v.viewer.name} src={v.viewer.image} size="md" />
                  <div className="min-w-0 flex-1">
                    <Link href={`/in/${v.viewer.username}`} className="text-sm font-semibold hover:underline">
                      {v.viewer.name}
                    </Link>
                    <div className="truncate text-xs text-fg-muted">{v.viewer.profile?.headline}</div>
                  </div>
                  <span className="text-xs text-fg-subtle">{f.timeAgo(v.createdAt)}</span>
                </li>
              ),
            )}
          </ul>
        )}
        {hidden > 0 && (
          <div className="mt-4 rounded-2xl bg-gradient-to-br from-brand/10 to-ember/10 p-5 text-center ring-1 ring-brand/20">
            <Lock className="mx-auto size-6 text-brand" />
            <div className="mt-2 font-semibold">{t("profileEdit.lockedTitle", { n: hidden })}</div>
            <div className="mt-1 text-sm text-fg-muted">{t("profileEdit.lockedBody")}</div>
            <Link href="/premium" className={buttonClasses({ className: "mt-4", pill: true })}>
              <Rocket /> {t("profileEdit.lockedCta")}
            </Link>
          </div>
        )}
      </Card>
    </div>
  );
}
