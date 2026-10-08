import Link from "next/link";
import { Crown, Rocket } from "lucide-react";
import { getI18n, pageTitle } from "@/i18n/server";
import { getViewer } from "@/server/session";
import { db } from "@/server/db";
import { personCardSelect, relationStates } from "@/server/services/network";
import { PersonCard } from "@/components/network/person-card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { NavTabs } from "@/components/ui/controls";
import { buttonClasses } from "@/components/ui/button";

export const generateMetadata = pageTitle("featuredPros.title");

export default async function FeaturedProfessionalsPage() {
  const [viewer, { t }] = await Promise.all([getViewer(), getI18n()]);
  const now = new Date();
  const people = await db.user.findMany({
    where: {
      profile: {
        featuredUntil: { gt: now },
        // Signed-out visitors only see public profiles; members also see members-only ones.
        visibility: viewer ? { in: ["PUBLIC", "MEMBERS"] } : "PUBLIC",
      },
      ...(viewer && {
        id: { not: viewer.id },
        blocksMade: { none: { blockedId: viewer.id } },
        blocksReceived: { none: { blockerId: viewer.id } },
      }),
    },
    select: personCardSelect,
    orderBy: { profile: { featuredUntil: "desc" } },
    take: 48,
  });
  const relations = viewer ? await relationStates(viewer.id, people.map((p) => p.id)) : null;

  return (
    <div className="space-y-6">
      {viewer && (
        <NavTabs
          layoutId="network-tabs"
          tabs={[
            { href: "/network", label: t("network.tabNetwork") },
            { href: "/companies", label: t("network.tabCompanies") },
            { href: "/professionals/featured", label: t("network.tabFeatured") },
          ]}
        />
      )}
      <PageHeader
        eyebrow={
          <span className="inline-flex items-center gap-1.5">
            <Crown className="size-3.5" /> {t("featuredPros.eyebrow")}
          </span>
        }
        title={t("featuredPros.title")}
        description={t("featuredPros.sub")}
        actions={
          <Link href="/premium" className={buttonClasses({ variant: "soft", pill: true })}>
            <Rocket /> {t("featuredPros.getFeatured")}
          </Link>
        }
      />
      {people.length === 0 ? (
        <EmptyState icon={<Crown />} title={t("featuredPros.none")} description={t("featuredPros.noneBody")} />
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {people.map((p) => (
            <PersonCard key={p.id} person={p} relation={relations?.get(p.id) ?? { state: viewer ? "none" : "none" }} />
          ))}
        </div>
      )}
    </div>
  );
}
