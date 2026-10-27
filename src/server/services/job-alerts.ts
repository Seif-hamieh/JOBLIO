import "server-only";
import { db, type Prisma } from "@/server/db";
import { buildJobWhere } from "@/server/services/jobs";
import { notify } from "@/server/services/notifications";
import { parseJobSearch, toQueryString } from "@/lib/validation/search";
import { k } from "@/i18n/message";

// Job alerts are saved job searches (saved_searches, kind JOB) with alerts on. After each job import, every active
// alert looks for jobs published since it was last checked that match its search — with the same rules as the jobs
// page (buildJobWhere) — and its owner gets one notification (in the app, by push and in the Alerts tab) with the
// count and a few titles. Shared by the website and the app.

/** At most this many saved searches per member (the website's existing limit). */
export const MAX_SAVED_SEARCHES = 25;

type Params = Record<string, string | number | string[]>;

const alertSelect = { id: true, name: true, params: true, alertsEnabled: true, lastAlertedAt: true, createdAt: true } as const;

export async function listJobAlerts(userId: string) {
  return db.savedSearch.findMany({ where: { userId, kind: "JOB" }, orderBy: { createdAt: "desc" }, select: alertSelect });
}

/** Saves a job search with alerts on (or off). Null when the member already has the most saved searches. */
export async function createJobAlert(userId: string, input: { name: string; params: Params; alertsEnabled?: boolean }) {
  if ((await db.savedSearch.count({ where: { userId } })) >= MAX_SAVED_SEARCHES) return null;
  return db.savedSearch.create({
    data: { userId, kind: "JOB", name: input.name, params: input.params as Prisma.InputJsonValue, alertsEnabled: input.alertsEnabled ?? true },
    select: alertSelect,
  });
}

/** Turns an alert on or off. Turning it on starts from now, so old jobs aren't announced all at once. */
export async function setJobAlertEnabled(userId: string, id: string, enabled: boolean) {
  const { count } = await db.savedSearch.updateMany({
    where: { id, userId, kind: "JOB" },
    data: { alertsEnabled: enabled, ...(enabled ? { lastAlertedAt: new Date() } : {}) },
  });
  return count > 0;
}

export async function deleteJobAlert(userId: string, id: string) {
  return (await db.savedSearch.deleteMany({ where: { id, userId, kind: "JOB" } })).count > 0;
}

/** A saved search's params as the jobs page reads them (lists are comma-separated in the address). */
function toSearch(params: Prisma.JsonValue) {
  const raw: Record<string, string> = {};
  if (params && typeof params === "object" && !Array.isArray(params)) {
    for (const [key, v] of Object.entries(params)) {
      if (Array.isArray(v)) raw[key] = v.join(",");
      else if (v != null) raw[key] = String(v);
    }
  }
  // The alert itself decides the time window; a saved "posted in the last N days" filter would only hide jobs.
  delete raw.posted;
  delete raw.page;
  return parseJobSearch(raw);
}

/** How many alerts are checked per run, so one import never takes too long. */
const BATCH = 500;
/** Job titles named in the notification. */
const TITLES = 3;

/**
 * Checks every active job alert for jobs published since its last check and notifies the owners. Called after the
 * nightly job import. Each alert moves its window forward even when nothing matched, so a job is announced once.
 */
export async function runJobAlerts(now = new Date()) {
  const alerts = await db.savedSearch.findMany({
    where: { kind: "JOB", alertsEnabled: true, user: { bannedAt: null } },
    orderBy: { lastAlertedAt: { sort: "asc", nulls: "first" } },
    take: BATCH,
    select: { id: true, userId: true, name: true, params: true, lastAlertedAt: true, createdAt: true },
  });
  let notified = 0;
  for (const alert of alerts) {
    try {
      const search = toSearch(alert.params);
      const since = alert.lastAlertedAt ?? alert.createdAt;
      const where: Prisma.JobWhereInput = {
        AND: [buildJobWhere(search), { publishedAt: { gt: since, lte: now } }, { postedById: { not: alert.userId } }],
      };
      const [count, jobs] = await Promise.all([
        db.job.count({ where }),
        db.job.findMany({ where, orderBy: { publishedAt: "desc" }, take: TITLES, select: { title: true } }),
      ]);
      if (count > 0) {
        await notify({
          userId: alert.userId,
          type: "JOB_ALERT",
          title: k("notif.jobAlert", { name: alert.name }),
          body: k("notif.jobAlertBody", { count, titles: jobs.map((j) => j.title).join(" · ") }),
          href: `/jobs${toQueryString({ ...search, sort: "newest" })}`,
        });
        notified++;
      }
      await db.savedSearch.update({ where: { id: alert.id }, data: { lastAlertedAt: now } });
    } catch (e) {
      console.error("[job-alerts] alert failed:", alert.id, e instanceof Error ? e.message : e);
    }
  }
  return { checked: alerts.length, notified };
}
