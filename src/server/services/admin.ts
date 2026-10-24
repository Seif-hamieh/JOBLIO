import "server-only";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { ActionError } from "@/server/action";
import { refreshSitemap } from "@/server/sitemap";
import { k } from "@/i18n/message";

// Admin changes, shared by the website's admin actions and the mobile API. Callers check that the member is an
// admin (from the database, never from the client). Each function returns its success message key, or throws
// ActionError with the reason it was refused.

export async function setUserRoleAsAdmin(adminId: string, userId: string, role: "USER" | "ADMIN") {
  if (userId === adminId) throw new ActionError(k("admin.msg.notSelf"));
  const { count } = await db.user.updateMany({ where: { id: userId }, data: { platformRole: role } });
  if (!count) throw new ActionError(k("admin.msg.userNotFound"));
  revalidatePath("/admin/users");
  return k(role === "ADMIN" ? "admin.msg.adminGranted" : "admin.msg.adminRevoked");
}

/** Publishes a draft (e.g. an imported job after review): it goes live in search, the sitemap and — for an imported company — makes the company page public. */
export async function publishJobAsAdmin(jobId: string) {
  const job = await db.job.findUnique({ where: { id: jobId }, select: { status: true, publishedAt: true } });
  if (!job) throw new ActionError(k("admin.msg.jobNotFound"));
  if (job.status !== "DRAFT") throw new ActionError(k("admin.msg.jobNotDraft"));
  await db.job.update({ where: { id: jobId }, data: { status: "OPEN", publishedAt: job.publishedAt ?? new Date() } });
  refreshSitemap();
  revalidatePath("/admin/jobs");
  revalidatePath("/jobs");
  return k("admin.msg.jobPublished");
}

/**
 * Settles every open report on a job: either closes the job too (the reports were right),
 * or just dismisses them (the job is fine). Either way it leaves Admin → Reports.
 */
export async function resolveJobReportsAsAdmin(jobId: string, alsoCloseJob: boolean) {
  await db.$transaction([
    ...(alsoCloseJob ? [db.job.updateMany({ where: { id: jobId, status: "OPEN" }, data: { status: "CLOSED" } })] : []),
    db.jobReport.updateMany({ where: { jobId, status: "OPEN" }, data: { status: "RESOLVED", resolvedAt: new Date() } }),
  ]);
  if (alsoCloseJob) refreshSitemap();
  revalidatePath("/admin/reports");
  revalidatePath("/admin/jobs");
  return k(alsoCloseJob ? "admin.msg.reportJobClosed" : "admin.msg.reportsDismissed");
}

export async function closeJobAsAdmin(jobId: string) {
  const { count } = await db.job.updateMany({ where: { id: jobId }, data: { status: "CLOSED" } });
  if (!count) throw new ActionError(k("admin.msg.jobNotFound"));
  revalidatePath("/admin/jobs");
  return k("admin.msg.jobClosed");
}

/** Permanent: the job's applications, saves and stats are deleted with it (cascade). */
export async function deleteJobAsAdmin(jobId: string) {
  const { count } = await db.job.deleteMany({ where: { id: jobId } });
  if (!count) throw new ActionError(k("admin.msg.jobNotFound"));
  revalidatePath("/admin/jobs");
  return k("admin.msg.jobDeleted");
}

export async function setCompanyVerifiedAsAdmin(companyId: string, verified: boolean) {
  const { count } = await db.company.updateMany({ where: { id: companyId }, data: { verified } });
  if (!count) throw new ActionError(k("admin.msg.companyNotFound"));
  revalidatePath("/admin/companies");
  return k(verified ? "admin.msg.companyVerified" : "admin.msg.companyUnverified");
}

/** Permanent: the company's jobs (with their applications), members, posts and media are deleted with it (cascade). */
export async function deleteCompanyAsAdmin(companyId: string) {
  const { count } = await db.company.deleteMany({ where: { id: companyId } });
  if (!count) throw new ActionError(k("admin.msg.companyNotFound"));
  revalidatePath("/admin/companies");
  return k("admin.msg.companyDeleted");
}
