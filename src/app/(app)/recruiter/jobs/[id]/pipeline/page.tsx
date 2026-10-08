import { getI18n, pageTitle } from "@/i18n/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Eye, Pencil, Search } from "lucide-react";
import { requireRecruiter } from "@/server/session";
import { getPipeline } from "@/server/services/recruiter";
import { PipelineBoard } from "@/components/recruiter/pipeline-board";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";

export const generateMetadata = pageTitle("recruiter.pipelineTitle");

export default async function PipelinePage({ params, searchParams }: PageProps<"/recruiter/jobs/[id]/pipeline">) {
  const { id } = await params;
  const { a } = await searchParams;
  const [viewer, { t }] = await Promise.all([requireRecruiter(), getI18n()]);
  const data = await getPipeline(id, viewer.company.id);
  if (!data) notFound();
  const cards = data.apps.map((x) => ({
    id: x.id,
    status: x.status,
    stage: x.stage,
    stagePosition: x.stagePosition,
    matchScore: x.matchScore,
    rating: x.rating,
    createdAt: x.createdAt,
    viewedAt: x.viewedAt,
    applicant: { id: x.applicant.id, name: x.applicant.name, image: x.applicant.image, username: x.applicant.username, profile: x.applicant.profile ? { headline: x.applicant.profile.headline } : null },
    interviews: x._count.interviews,
  }));
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/recruiter" className="mb-2 inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg">
            <ArrowLeft className="size-4" /> {t("recruiter.dashboard")}
          </Link>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-semibold">{data.job.title}</h1>
            <Badge tone={data.job.status === "OPEN" ? "mint" : "neutral"}>{t(`enums.jobStatus.${data.job.status}`)}</Badge>
          </div>
          <p className="text-sm text-fg-muted">
            {t(`enums.workMode.${data.job.workMode}`)}
            {data.job.city ? ` · ${data.job.city}` : ""} · {t("recruiter.pipelineHelp", { n: cards.length })}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/recruiter/candidates?job=${data.job.id}`} className={buttonClasses({ variant: "soft", size: "sm", pill: true })}>
            <Search /> {t("recruiter.findMatching")}
          </Link>
          <Link href={`/recruiter/jobs/${data.job.id}/edit`} className={buttonClasses({ variant: "outline", size: "sm", pill: true })}>
            <Pencil /> {t("common.edit")}
          </Link>
          <Link href={`/jobs/${data.job.id}`} className={buttonClasses({ variant: "ghost", size: "sm", pill: true })}>
            <Eye /> {t("recruiter.view")}
          </Link>
        </div>
      </div>
      <PipelineBoard initial={cards} openId={typeof a === "string" ? a : null} />
    </div>
  );
}
