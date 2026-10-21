import { getI18n, pageTitle } from "@/i18n/server";
import Link from "next/link";
import { Hash, TrendingUp } from "lucide-react";
import { requireViewer } from "@/server/session";
import { getFeed } from "@/server/services/feed";
import { composerData } from "@/server/services/composer";
import { publicCompanyWhere } from "@/server/services/companies";
import { suggestions, relationStates } from "@/server/services/network";
import { db } from "@/server/db";
import { Composer } from "@/components/feed/composer";
import { FeedList } from "@/components/feed/feed-list";
import { PersonCard } from "@/components/network/person-card";
import { ProfileSummaryCard } from "@/components/profile/profile-summary-card";
import { Card, CardHeader } from "@/components/ui/misc";
import { NavTabs } from "@/components/ui/controls";
import { CompanyLogo } from "@/components/ui/avatar";

export const generateMetadata = pageTitle("meta.feed");

export default async function FeedPage({ searchParams }: PageProps<"/feed">) {
  // "My network" (default): you, your connections and who you follow. "Everyone" adds recent public posts.
  const everyone = (await searchParams).scope === "all";
  const [viewer, { t }] = await Promise.all([requireViewer(), getI18n()]);
  const [feed, composer, people, companies] = await Promise.all([
    getFeed(viewer.id, { networkOnly: !everyone }),
    composerData(viewer),
    suggestions(viewer.id, 4),
    db.company.findMany({
      where: { followers: { none: { userId: viewer.id } }, members: { none: { userId: viewer.id } }, ...publicCompanyWhere },
      orderBy: { followerCount: "desc" },
      take: 4,
      select: { id: true, slug: true, name: true, logoUrl: true, brandColor: true, tagline: true },
    }),
  ]);
  const relations = await relationStates(viewer.id, people.map((p) => p.user.id));

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_1fr_300px]">
      <aside className="hidden lg:block">
        <div className="sticky top-24">
          <ProfileSummaryCard viewer={viewer} />
        </div>
      </aside>
      <section className="min-w-0 space-y-4">
        <Composer viewer={{ name: viewer.name, image: viewer.image }} {...composer} />
        <NavTabs
          layoutId="feed-scope"
          tabs={[
            { href: "/feed", label: t("feed.tabNetwork"), exact: true },
            { href: "/feed?scope=all", label: t("feed.tabEveryone"), exact: true },
          ]}
        />
        <FeedList
          key={everyone ? "all" : "network"}
          initial={feed.posts}
          nextCursor={feed.nextCursor}
          scope={{ networkOnly: !everyone }}
          viewer={{ id: viewer.id, name: viewer.name, image: viewer.image }}
          emptyTitle={everyone ? undefined : t("feed.networkEmptyTitle")}
          emptyDescription={everyone ? undefined : t("feed.networkEmptyBody")}
        />
      </section>
      <aside className="hidden space-y-4 lg:block">
        {people.length > 0 && (
          <Card className="p-5">
            <CardHeader title={t("network.pymk")} description={t("network.pymkSub")} />
            <div className="mt-4 space-y-4">
              {people.map((s) => (
                <PersonCard key={s.user.id} person={s.user} relation={relations.get(s.user.id) ?? { state: "none" }} reason={s.reason} compact />
              ))}
            </div>
            <Link href="/network" className="mt-4 block text-center text-sm font-medium text-brand-soft-fg hover:underline">
              {t("common.seeAll")}
            </Link>
          </Card>
        )}
        {companies.length > 0 && (
          <Card className="p-5">
            <CardHeader title={t("feed.companiesToFollow")} />
            <div className="mt-4 space-y-3">
              {companies.map((c) => (
                <Link key={c.id} href={`/companies/${c.slug}`} className="flex items-center gap-3 rounded-xl p-1 hover:bg-surface-2">
                  <CompanyLogo name={c.name} src={c.logoUrl} color={c.brandColor} size="sm" />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{c.name}</div>
                    <div className="truncate text-xs text-fg-muted">{c.tagline}</div>
                  </div>
                </Link>
              ))}
            </div>
          </Card>
        )}
        <Card className="p-5">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <TrendingUp className="size-4 text-brand" /> {t("feed.howWorks")}
          </div>
          <p className="mt-2 text-xs leading-relaxed text-fg-muted">
            {t("feed.howWorksBody")}
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5 text-xs text-fg-subtle">
            {["careers", "hiring", "design", "engineering"].map((tag) => (
              <span key={tag} className="inline-flex items-center gap-0.5 rounded-full bg-surface-2 px-2 py-0.5">
                <Hash className="size-3" />
                {tag}
              </span>
            ))}
          </div>
        </Card>
      </aside>
    </div>
  );
}
