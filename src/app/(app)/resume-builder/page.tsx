import { getI18n, getLocale, pageTitle } from "@/i18n/server";
import { requireViewer } from "@/server/session";
import { getResume } from "@/server/services/resume-builder";
import { ResumeBuilder } from "@/components/resume/resume-builder";
import { PageHeader } from "@/components/ui/misc";

export const generateMetadata = pageTitle("cvb.title");

/** The CV builder: fill in your CV (started from your profile) and download it as a PDF. */
export default async function ResumeBuilderPage() {
  const [viewer, { t }, locale] = await Promise.all([requireViewer(), getI18n(), getLocale()]);
  const { data, saved, updatedAt } = await getResume(viewer.id, locale);
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title={t("cvb.title")} description={t("cvb.sub")} />
      <ResumeBuilder initial={data} saved={saved} updatedAt={updatedAt?.toISOString() ?? null} />
    </div>
  );
}
