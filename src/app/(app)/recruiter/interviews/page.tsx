import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { getI18n, pageTitle } from "@/i18n/server";
import { requireRecruiter } from "@/server/session";
import { TeamInterviewList, teamInterviews } from "@/components/interviews/team-interviews";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { buttonClasses } from "@/components/ui/button";

export const generateMetadata = pageTitle("interviews.teamTitle");

/** The company's interviews, inside the hiring workspace (recruiter header and tabs). */
export default async function RecruiterInterviewsPage() {
  const [viewer, { t }] = await Promise.all([requireRecruiter(), getI18n()]);
  const items = await teamInterviews(viewer.company.id);
  return (
    <div className="space-y-6">
      <PageHeader title={t("interviews.teamTitle")} description={t("interviews.teamSub")} />
      {items.length ? (
        <TeamInterviewList items={items} />
      ) : (
        <EmptyState
          icon={<CalendarDays />}
          title={t("interviews.teamNone")}
          description={t("interviews.teamNoneBody")}
          action={
            <Link href="/recruiter" className={buttonClasses({ variant: "outline", pill: true })}>
              {t("recruiter.tabDashboard")}
            </Link>
          }
        />
      )}
    </div>
  );
}
