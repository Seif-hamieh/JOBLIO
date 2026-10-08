import { getI18n, pageTitle } from "@/i18n/server";
import Link from "next/link";
import { Bookmark, Search } from "lucide-react";
import { requireRecruiter } from "@/server/session";
import { db } from "@/server/db";
import { SaveCandidateButton } from "@/components/recruiter/save-candidate-button";
import { DeleteSavedSearch } from "@/components/jobs/saved-search-actions";
import { Avatar } from "@/components/ui/avatar";
import { OpenToWorkBadge } from "@/components/ui/badge";
import { Card, CardHeader, EmptyState } from "@/components/ui/misc";
import { buttonClasses } from "@/components/ui/button";
import { toQueryString } from "@/lib/validation/search";

export const generateMetadata = pageTitle("recruiter.tabSaved");

export default async function SavedCandidatesPage() {
  const [viewer, { t, f }] = await Promise.all([requireRecruiter(), getI18n()]);
  const [saved, searches] = await Promise.all([
    db.savedCandidate.findMany({
      where: { recruiterId: viewer.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, note: true, createdAt: true, candidate: { select: { id: true, name: true, image: true, username: true, profile: { select: { headline: true, openToWork: true } } } } },
    }),
    db.savedSearch.findMany({ where: { userId: viewer.id, kind: "CANDIDATE" }, orderBy: { createdAt: "desc" } }),
  ]);
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">{t("recruiter.savedTitle", { n: saved.length })}</h2>
        {saved.length === 0 ? (
          <EmptyState
            icon={<Bookmark />}
            title={t("recruiter.noSaved")}
            description={t("recruiter.noSavedBody")}
            action={
              <Link href="/recruiter/candidates" className={buttonClasses({ pill: true })}>
                {t("recruiter.searchCandidates")}
              </Link>
            }
          />
        ) : (
          <div className="surface divide-y divide-border">
            {saved.map((s) => (
              <div key={s.id} className="flex flex-wrap items-center gap-3 p-4">
                <Avatar name={s.candidate.name} src={s.candidate.image} size="md" />
                <div className="min-w-0 flex-1">
                  <Link href={`/recruiter/candidates/${s.candidate.username}`} className="font-semibold hover:underline">
                    {s.candidate.name}
                  </Link>
                  <div className="truncate text-sm text-fg-muted">{s.candidate.profile?.headline}</div>
                  {s.note && <p className="mt-1 text-xs text-fg-subtle">“{s.note}”</p>}
                  <div className="mt-1 text-[11px] text-fg-subtle">{t("recruiter.savedAgo", { when: f.timeAgo(s.createdAt) })}</div>
                </div>
                {s.candidate.profile?.openToWork && <OpenToWorkBadge />}
                <SaveCandidateButton candidateId={s.candidate.id} saved />
              </div>
            ))}
          </div>
        )}
      </section>
      <aside>
        <Card className="p-5">
          <CardHeader title={t("recruiter.savedSearches")} description={viewer.recruiterPro ? undefined : t("recruiter.proFeature")} />
          <ul className="mt-3 space-y-1">
            {searches.length === 0 && <li className="text-sm text-fg-muted">{t("recruiter.noSavedSearches")}</li>}
            {searches.map((s) => (
              <li key={s.id} className="flex items-center gap-2">
                <Link href={`/recruiter/candidates${toQueryString(s.params as Record<string, unknown>, {}, { page: 1, sort: "match" })}`} className="flex flex-1 items-center gap-2 rounded-xl p-2 text-sm hover:bg-surface-2">
                  <Search className="size-4 text-fg-subtle" /> {s.name}
                </Link>
                <DeleteSavedSearch id={s.id} />
              </li>
            ))}
          </ul>
        </Card>
      </aside>
    </div>
  );
}
