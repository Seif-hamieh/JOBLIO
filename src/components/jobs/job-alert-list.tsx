import Link from "next/link";
import { Bell, Search } from "lucide-react";
import { getI18n } from "@/i18n/server";
import { DeleteSavedSearch, ToggleJobAlert } from "@/components/jobs/saved-search-actions";
import { toQueryString } from "@/lib/validation/search";
import type { listJobAlerts } from "@/server/services/job-alerts";

/**
 * Saved job searches with their alert bell (on/off), a link that runs the search, and delete. Shown on Saved jobs
 * and in Settings → Job alerts.
 */
export async function JobAlertList({ alerts }: { alerts: Awaited<ReturnType<typeof listJobAlerts>> }) {
  const { t } = await getI18n();
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {alerts.map((s) => (
        <div key={s.id} className="surface flex items-center gap-3 p-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand-soft-fg">
            {s.alertsEnabled ? <Bell className="size-4" /> : <Search className="size-4" />}
          </span>
          <Link href={`/jobs${toQueryString(s.params as Record<string, unknown>)}`} className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold hover:underline">{s.name}</div>
            <div className="text-xs text-fg-muted">{s.alertsEnabled ? t("jobs.alertsOn") : t("jobs.runSearch")}</div>
          </Link>
          <ToggleJobAlert id={s.id} enabled={s.alertsEnabled} />
          <DeleteSavedSearch id={s.id} />
        </div>
      ))}
    </div>
  );
}
