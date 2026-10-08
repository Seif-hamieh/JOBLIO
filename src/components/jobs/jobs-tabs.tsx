"use client";

import { NavTabs } from "@/components/ui/controls";
import { useI18n } from "@/i18n/client";

export function JobsTabs() {
  const { t } = useI18n();
  return (
    <NavTabs
      layoutId="jobs-tabs"
      tabs={[
        { href: "/jobs", label: t("jobs.tabSearch"), exact: true },
        { href: "/jobs/for-you", label: t("jobs.tabForYou") },
        { href: "/jobs/saved", label: t("jobs.tabSaved") },
        { href: "/applications", label: t("jobs.tabApplications") },
        { href: "/interviews", label: t("jobs.tabInterviews") },
        { href: "/jobs/featured", label: t("jobs.tabFeatured") },
      ]}
    />
  );
}