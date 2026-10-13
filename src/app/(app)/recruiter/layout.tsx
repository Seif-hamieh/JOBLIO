import Link from "next/link";
import { Crown, Plus } from "lucide-react";
import { requireViewer } from "@/server/session";
import { NavTabs } from "@/components/ui/controls";
import { CompanyLogo } from "@/components/ui/avatar";
import { buttonClasses } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getI18n } from "@/i18n/server";

export default async function RecruiterLayout({ children }: { children: React.ReactNode }) {
  const [viewer, { t }] = await Promise.all([requireViewer(), getI18n()]);
  if (!viewer.company) return <>{children}</>;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <CompanyLogo name={viewer.company.name} src={viewer.company.logoUrl} size="md" />
          <div>
            <div className="flex items-center gap-2 font-display font-semibold">
              {viewer.company.name}
              {viewer.recruiterPro ? (
                <Badge tone="ember" size="xs">
                  <Crown /> {t("footer.recruiterPro")}
                </Badge>
              ) : (
                <Link href="/premium#business">
                  <Badge tone="outline" size="xs">
                    {t("recruiter.freeWorkspace")}
                  </Badge>
                </Link>
              )}
            </div>
            <div className="text-xs text-fg-muted">{t("recruiter.workspace")}</div>
          </div>
        </div>
        <Link href="/recruiter/jobs/new" className={buttonClasses({ pill: true })}>
          <Plus /> {t("recruiter.postJob")}
        </Link>
      </div>
      <NavTabs
        layoutId="recruiter-tabs"
        tabs={[
          { href: "/recruiter", label: t("recruiter.tabDashboard"), exact: true },
          { href: "/recruiter/candidates", label: t("recruiter.tabCandidates") },
          { href: "/recruiter/saved", label: t("recruiter.tabSaved") },
          { href: "/recruiter/interviews", label: t("recruiter.tabInterviews") },
          { href: "/company/dashboard", label: t("recruiter.tabCompany") },
        ]}
      />
      {children}
    </div>
  );
}
