import { getI18n, pageTitle } from "@/i18n/server";
import Link from "next/link";
import { Building2, Search, UserPlus, Users } from "lucide-react";
import { requireViewer } from "@/server/session";
import { db } from "@/server/db";
import { connectionIds, networkStats, personCardSelect, relationStates, suggestions } from "@/server/services/network";
import { PersonCard } from "@/components/network/person-card";
import { ConnectButton } from "@/components/network/connect-button";
import { NetworkOrbit } from "@/components/network/network-orbit";
import { Avatar, CompanyLogo } from "@/components/ui/avatar";
import { Card, CardHeader, EmptyState, PageHeader } from "@/components/ui/misc";
import { NavTabs } from "@/components/ui/controls";
import { buttonClasses } from "@/components/ui/button";

export const generateMetadata = pageTitle("network.title");

export default async function NetworkPage({ searchParams }: PageProps<"/network">) {
  const [viewer, { t, f }] = await Promise.all([requireViewer(), getI18n()]);
  const { q } = await searchParams;
  const query = typeof q === "string" ? q.trim().slice(0, 60) : "";

  const ids = await connectionIds(viewer.id);
  const [incoming, outgoing, stats, people, connections, companies] = await Promise.all([
    db.connection.findMany({
      where: { addresseeId: viewer.id, status: "PENDING" },
      orderBy: { createdAt: "desc" },
      select: { id: true, message: true, createdAt: true, requester: { select: personCardSelect } },
    }),
    db.connection.count({ where: { requesterId: viewer.id, status: "PENDING" } }),
    networkStats(viewer.id),
    suggestions(viewer.id, 8),
    db.user.findMany({
      where: { id: { in: ids }, ...(query && { OR: [{ name: { contains: query, mode: "insensitive" } }, { profile: { headline: { contains: query, mode: "insensitive" } } }] }) },
      select: personCardSelect,
      orderBy: { name: "asc" },
      take: 60,
    }),
    db.companyFollower.findMany({ where: { userId: viewer.id }, take: 8, select: { company: { select: { id: true, slug: true, name: true, logoUrl: true, brandColor: true, tagline: true } } } }),
  ]);
  const relations = await relationStates(viewer.id, people.map((p) => p.user.id));

  return (
    <div className="space-y-6">
      <NavTabs
        layoutId="network-tabs"
        tabs={[
          { href: "/network", label: t("network.tabNetwork"), count: incoming.length },
          { href: "/companies", label: t("network.tabCompanies") },
          { href: "/professionals/featured", label: t("network.tabFeatured") },
        ]}
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-6">
          <PageHeader title={t("network.title")} description={t("network.sub")} />

          {incoming.length > 0 && (
            <Card className="p-5">
              <CardHeader title={t("network.invitations", { n: incoming.length })} />
              <ul className="mt-4 divide-y divide-border">
                {incoming.map((c) => (
                  <li key={c.id} className="flex flex-col gap-3 py-3.5 sm:flex-row sm:items-center">
                    <Link href={`/in/${c.requester.username}`} className="flex min-w-0 flex-1 items-center gap-3">
                      <Avatar name={c.requester.name} src={c.requester.image} size="md" />
                      <div className="min-w-0">
                        <div className="text-sm font-semibold hover:underline">{c.requester.name}</div>
                        <div className="truncate text-xs text-fg-muted">{c.requester.profile?.headline}</div>
                        {c.message && <p className="mt-1 rounded-lg bg-surface-2 px-2.5 py-1.5 text-xs text-fg-muted">“{c.message}”</p>}
                        <div className="mt-1 text-[11px] text-fg-subtle">{f.timeAgo(c.createdAt)}</div>
                      </div>
                    </Link>
                    <ConnectButton userId={c.requester.id} name={c.requester.name} state="pending-in" connectionId={c.id} />
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <section>
            <h2 className="mb-3 font-display text-lg font-semibold">{t("network.pymk")}</h2>
            {people.length ? (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
                {people.map((s) => (
                  <PersonCard key={s.user.id} person={s.user} relation={relations.get(s.user.id) ?? { state: "none" }} reason={s.reason} />
                ))}
              </div>
            ) : (
              <EmptyState icon={<UserPlus />} title={t("network.noSuggestions")} description={t("network.noSuggestionsBody")} />
            )}
          </section>

          <section>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-lg font-semibold">{t("network.connections", { n: stats.connections })}</h2>
              <form className="relative w-full sm:w-64">
                <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" />
                <input name="q" defaultValue={query} placeholder={t("network.searchConnections")} className="h-10 w-full rounded-full border border-border bg-surface ps-9 pe-4 text-sm outline-none focus:border-brand" />
              </form>
            </div>
            {connections.length ? (
              <div className="surface divide-y divide-border">
                {connections.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 p-3.5">
                    <Link href={`/in/${p.username}`}>
                      <Avatar name={p.name} src={p.image} size="md" />
                    </Link>
                    <div className="min-w-0 flex-1">
                      <Link href={`/in/${p.username}`} className="text-sm font-semibold hover:underline">
                        {p.name}
                      </Link>
                      <div className="truncate text-xs text-fg-muted">{p.profile?.headline}</div>
                    </div>
                    <Link href={`/messages?to=${p.id}`} className={buttonClasses({ variant: "outline", size: "sm", pill: true })}>
                      {t("common.message")}
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState icon={<Users />} title={query ? t("network.noMatch") : t("network.noneYet")} description={t("network.noneBody")} />
            )}
          </section>
        </div>

        <aside className="space-y-4">
          <Card className="p-5">
            <NetworkOrbit
              me={{ id: viewer.id, name: viewer.name, image: viewer.image, username: viewer.username }}
              people={connections.slice(0, 16).map((p) => ({ id: p.id, name: p.name, image: p.image, username: p.username! }))}
              total={stats.connections}
            />
            <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
              {[
                [t("network.followers"), stats.followers],
                [t("network.following"), stats.following],
                [t("network.sent"), outgoing],
              ].map(([label, n]) => (
                <div key={label as string} className="rounded-xl bg-surface-2 p-2.5">
                  <dt className="text-[11px] text-fg-muted">{label}</dt>
                  <dd className="font-display text-lg font-semibold">{n}</dd>
                </div>
              ))}
            </dl>
          </Card>
          <Card className="p-5">
            <CardHeader
              title={t("network.companiesFollow", { n: stats.companies })}
              action={
                <Link href="/companies" className="text-xs font-medium text-brand-soft-fg hover:underline">
                  {t("home.explore")}
                </Link>
              }
            />
            <div className="mt-3 space-y-2">
              {companies.length === 0 && <p className="text-sm text-fg-muted">{t("network.followHint")}</p>}
              {companies.map(({ company: c }) => (
                <Link key={c.id} href={`/companies/${c.slug}`} className="flex items-center gap-3 rounded-xl p-1.5 hover:bg-surface-2">
                  <CompanyLogo name={c.name} src={c.logoUrl} color={c.brandColor} size="sm" />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{c.name}</div>
                    <div className="truncate text-xs text-fg-muted">{c.tagline}</div>
                  </div>
                </Link>
              ))}
            </div>
            <Link href="/companies" className={buttonClasses({ variant: "ghost", size: "sm", className: "mt-2 w-full" })}>
              <Building2 /> {t("network.discover")}
            </Link>
          </Card>
        </aside>
      </div>
    </div>
  );
}
