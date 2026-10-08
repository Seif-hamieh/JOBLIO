import { getI18n, pageTitle } from "@/i18n/server";
import { notFound } from "next/navigation";
import { requireRecruiter } from "@/server/session";
import { listIndustries } from "@/server/services/companies";
import { db } from "@/server/db";
import { JobForm } from "@/components/recruiter/job-form";
import { PageHeader } from "@/components/ui/misc";

export const generateMetadata = pageTitle("recruiter.editJob");

export default async function EditJobPage({ params }: PageProps<"/recruiter/jobs/[id]/edit">) {
  const { id } = await params;
  const [viewer, { t }] = await Promise.all([requireRecruiter(), getI18n()]);
  const [job, industries, company] = await Promise.all([
    db.job.findFirst({
      where: { id, companyId: viewer.company.id },
      include: { skills: { include: { skill: { select: { name: true } } } }, languages: true },
    }),
    listIndustries(),
    db.company.findUniqueOrThrow({ where: { id: viewer.company.id }, select: { name: true, logoUrl: true } }),
  ]);
  if (!job) notFound();
  return (
    <div className="space-y-6">
      <PageHeader title={t("recruiter.editJob")} description={job.title} />
      <JobForm
        jobId={job.id}
        company={company}
        industries={industries}
        isDraft={job.status === "DRAFT"}
        initial={{
          title: job.title,
          summary: job.summary ?? "",
          description: job.description,
          responsibilities: job.responsibilities,
          requirements: job.requirements,
          benefits: job.benefits,
          workMode: job.workMode,
          employmentType: job.employmentType,
          experienceLevel: job.experienceLevel,
          minYearsExperience: job.minYearsExperience,
          educationLevel: job.educationLevel,
          city: job.city ?? "",
          countryCode: job.countryCode ?? "",
          salaryMin: job.salaryMin,
          salaryMax: job.salaryMax,
          salaryCurrency: job.salaryCurrency,
          salaryPeriod: job.salaryPeriod,
          industryId: job.industryId ?? "",
          closesAt: job.closesAt ? job.closesAt.toISOString().slice(0, 10) : "",
          skills: job.skills.map((s) => ({ skillId: s.skillId, name: s.skill.name, required: s.required, minLevel: s.minLevel })),
          languages: job.languages.map((l) => ({ languageCode: l.languageCode, minProficiency: l.minProficiency })),
        }}
      />
    </div>
  );
}
