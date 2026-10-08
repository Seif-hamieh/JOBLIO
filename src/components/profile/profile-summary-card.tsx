import Link from "next/link";
import { Crown, Eye, Rocket, Users } from "lucide-react";
import { db } from "@/server/db";
import type { Viewer } from "@/server/session";
import { Avatar } from "@/components/ui/avatar";
import { OpenToWorkBadge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/motion";
import { getI18n } from "@/i18n/server";

export async function ProfileSummaryCard({ viewer }: { viewer: Viewer }) {
  const since = new Date(Date.now() - 30 * 86_400_000);
  const [{ t }, profile, views, connections] = await Promise.all([
    getI18n(),
    db.profile.findUnique({ where: { id: viewer.profileId }, select: { completeness: true, coverUrl: true, featuredUntil: true } }),
    db.profileView.count({ where: { viewedId: viewer.id, createdAt: { gte: since } } }),
    db.connection.count({ where: { status: "ACCEPTED", OR: [{ requesterId: viewer.id }, { addresseeId: viewer.id }] } }),
  ]);
  const completeness = profile?.completeness ?? 0;
  return (
    <div className="surface overflow-hidden">
      <div
        className="h-16 bg-gradient-to-r from-brand via-aurora to-mint opacity-90"
        style={profile?.coverUrl ? { backgroundImage: `url(${profile.coverUrl})`, backgroundSize: "cover" } : undefined}
      />
      <div className="px-5 pb-5">
        <Link href={`/in/${viewer.username}`} className="-mt-8 inline-block">
          <Avatar name={viewer.name} src={viewer.image} size="lg" ring />
        </Link>
        <Link href={`/in/${viewer.username}`} className="mt-1 flex items-center gap-1 font-display font-semibold hover:underline">
          {viewer.name}
          {viewer.boosted && <Crown className="size-4 text-ember" aria-label={t("footer.careerBoost")} />}
        </Link>
        <p className="line-clamp-2 text-xs text-fg-muted">{viewer.headline ?? t("summary.addHeadline")}</p>
        {viewer.openToWork && <OpenToWorkBadge className="mt-2" />}

        <div className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
          <Link href="/profile/views" className="flex items-center justify-between rounded-lg text-fg-muted hover:text-fg">
            <span className="inline-flex items-center gap-2">
              <Eye className="size-4" /> {t("summary.views30")}
            </span>
            <span className="font-semibold text-brand-soft-fg">{views}</span>
          </Link>
          <Link href="/network" className="flex items-center justify-between text-fg-muted hover:text-fg">
            <span className="inline-flex items-center gap-2">
              <Users className="size-4" /> {t("summary.connections")}
            </span>
            <span className="font-semibold text-brand-soft-fg">{connections}</span>
          </Link>
        </div>

        {completeness < 100 && (
          <Link href="/profile/edit" className="mt-4 block rounded-2xl bg-surface-2 p-3 transition hover:bg-surface-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium">{t("summary.strength")}</span>
              <span className="font-semibold">{completeness}%</span>
            </div>
            <ProgressBar value={completeness} className="mt-2 h-1.5" />
          </Link>
        )}
        {!viewer.boosted && (
          <Link href="/premium" className="mt-3 flex items-center gap-2 rounded-2xl border border-ember/30 bg-ember-soft/60 p-3 text-xs font-medium text-ember-fg transition hover:bg-ember-soft">
            <Rocket className="size-4" /> {t("summary.boost")}
          </Link>
        )}
      </div>
    </div>
  );
}
