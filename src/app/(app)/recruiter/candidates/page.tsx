import { getI18n, pageTitle } from "@/i18n/server";
import Link from "next/link";
import { Crown, Lock, UsersRound } from "lucide-react";
import { requireRecruiter } from "@/server/session";
import { db } from "@/server/db";
import { searchCandidates } from "@/server/services/recruiter";
import { CandidateFilters } from "@/components/recruiter/candidate-filters";
import { CandidateCard } from "@/components/recruiter/candidate-card";
import { EmptyState, Pagination } from "@/components/ui/misc";
import { buttonClasses } from "@/components/ui/button";
import { parseCandidateSearch, toQueryString } from "@/lib/validation/search";

export const generateMetadata = pageTitle("recruiter.tabCandidates");

export default async function CandidateSearchPage({ searchParams }: PageProps<"/recruiter/candidates">) {
  const [viewer, { t, f }] = await Promise.all([requireRecruiter(), getI18n()]);
  const params = parseCandidateSearch(await searchParams);
  const [result, jobs, saved, skills] = await Promise.all([
    searchCandidates(params, { id: viewer.id, companyId: viewer.company.id, pro: viewer.recruiterPro }),
    db.job.findMany({ where: { companyId: viewer.company.id, status: "OPEN" }, select: { id: true, title: true }, orderBy: { publishedAt: "desc" } }),
    db.savedCandidate.findMany({ where: { recruiterId: viewer.id }, select: { candidateId: true } }),
    params.skills.length ? db.skill.findMany({ where: { slug: { in: params.skills } }, select: { slug: true, name: true } }) : [],
  ]);
  const savedSet = new Set(saved.map((s) => s.candidateId));
  const skillNames = Object.fromEntries(skills.map((s) => [s.slug, s.name]));

  return (
    <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
      <aside>
        <div className="lg:sticky lg:top-24">
          <CandidateFilters key={toQueryString(params, { page: 1 })} params={params} pro={viewer.recruiterPro} jobs={jobs} skillNames={skillNames} />
        </div>
      </aside>
      <section className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-fg-muted">
            <span className="font-semibold text-fg">{t("recruiter.candidates", { n: f.number(result.total) })}</span>
            {result.job && (
              <>
                {" "}
                {t("recruiter.rankedFor")} <span className="font-medium text-fg">{result.job.title}</span>
              </>
            )}
          </p>
          <p className="text-xs text-fg-subtle">{t("recruiter.onlySearchable")}</p>
        </div>

        {result.featured.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-ember-fg">
              <Crown className="size-3.5" /> {t("recruiter.featuredStrip")}
            </div>
            {result.featured.map((c) => (
              <CandidateCard key={`f-${c.id}`} c={c} saved={savedSet.has(c.id)} highlightSkills={params.skills} jobId={result.job?.id} />
            ))}
          </div>
        )}

        {result.results.length === 0 ? (
          <EmptyState icon={<UsersRound />} title={t("recruiter.noCandidates")} description={t("recruiter.noCandidatesBody")} />
        ) : (
          result.results.map((c) => <CandidateCard key={c.id} c={c} saved={savedSet.has(c.id)} highlightSkills={params.skills} jobId={result.job?.id} />)
        )}

        {result.limited && (
          <div className="flex flex-col items-center gap-3 rounded-3xl border border-ember/30 bg-ember-soft/40 p-6 text-center">
            <Lock className="size-5 text-ember-fg" />
            <p className="max-w-md text-sm">
              {t("recruiter.limited", { shown: result.results.length, total: f.number(result.total) })}
            </p>
            <Link href="/premium#business" className={buttonClasses({ pill: true })}>
              {t("recruiter.upgradePro")}
            </Link>
          </div>
        )}
        <Pagination page={params.page} pageCount={result.pageCount} href={(page) => `/recruiter/candidates${toQueryString(params, { page }, { page: 1, sort: "match" })}`} />
      </section>
    </div>
  );
}
