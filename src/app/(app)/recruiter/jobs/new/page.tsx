import { getI18n, pageTitle } from "@/i18n/server";
import { requireRecruiter } from "@/server/session";
import { listIndustries } from "@/server/services/companies";
import { db } from "@/server/db";
import { EMPTY_JOB, JobForm } from "@/components/recruiter/job-form";
import { PageHeader } from "@/components/ui/misc";

export const generateMetadata = pageTitle("recruiter.postJob");

export default async function NewJobPage() {
  const [viewer, { t }] = await Promise.all([requireRecruiter(), getI18n()]);
  const [industries, company] = await Promise.all([
    listIndustries(),
    db.company.findUniqueOrThrow({ where: { id: viewer.company.id }, select: { name: true, logoUrl: true, city: true, countryCode: true, industryId: true, benefits: true } }),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader title={t("recruiter.postJob")} description={t("recruiter.postJobSub")} />
      <JobForm
        company={company}
        industries={industries}
        isDraft
        initial={{ ...EMPTY_JOB, city: company.city ?? "", countryCode: company.countryCode ?? "", industryId: company.industryId ?? "", benefits: company.benefits.slice(0, 6) }}
      />
    </div>
  );
}
