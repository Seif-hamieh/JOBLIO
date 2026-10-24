"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db";
import { fail, withViewer, type ActionState } from "@/server/action";
import { LIMITS } from "@/server/rate-limit";
import { k } from "@/i18n/message";
import type { Viewer } from "@/server/session";
import {
  banUserAsAdmin,
  closeJobAsAdmin,
  deleteCompanyAsAdmin,
  deleteJobAsAdmin,
  publishJobAsAdmin,
  resolveJobReportsAsAdmin,
  resolvePostReportsAsAdmin,
  setCompanyVerifiedAsAdmin,
  setUserRoleAsAdmin,
  unbanUserAsAdmin,
} from "@/server/services/admin";

// Admin-only mutations. Each one re-checks the role from the database (getViewer) —
// hiding buttons in the UI is not a security boundary. The rules live in services/admin (shared with the app).

function asAdmin<R>(fn: (admin: Viewer) => Promise<ActionState<R>>): Promise<ActionState<R>> {
  return withViewer({ limit: LIMITS.write }, async (viewer) => {
    if (!viewer.isAdmin) return fail(k("admin.msg.forbidden"));
    return fn(viewer);
  });
}

const Id = z.string().min(1).max(64);

export async function setUserRole(userId: string, role: "USER" | "ADMIN") {
  return asAdmin(async (admin) => ({ ok: true, message: await setUserRoleAsAdmin(admin.id, Id.parse(userId), z.enum(["USER", "ADMIN"]).parse(role)) }));
}

/** Publishes a draft (e.g. an imported job after review). */
export async function publishJob(jobId: string) {
  return asAdmin(async () => ({ ok: true, message: await publishJobAsAdmin(Id.parse(jobId)) }));
}

/** Settles every open report on a job: closes the job too, or just dismisses the reports. */
export async function resolveJobReports(jobId: string, alsoCloseJob: boolean) {
  return asAdmin(async () => ({ ok: true, message: await resolveJobReportsAsAdmin(Id.parse(jobId), z.boolean().parse(alsoCloseJob)) }));
}

export async function closeJob(jobId: string) {
  return asAdmin(async () => ({ ok: true, message: await closeJobAsAdmin(Id.parse(jobId)) }));
}

/** Permanent: the job's applications, saves and stats are deleted with it (cascade). */
export async function deleteJob(jobId: string) {
  return asAdmin(async () => ({ ok: true, message: await deleteJobAsAdmin(Id.parse(jobId)) }));
}

export async function setCompanyVerified(companyId: string, verified: boolean) {
  return asAdmin(async () => ({ ok: true, message: await setCompanyVerifiedAsAdmin(Id.parse(companyId), z.boolean().parse(verified)) }));
}

/** Permanent: the company's jobs (with their applications), members, posts and media are deleted with it (cascade). */
export async function deleteCompany(companyId: string) {
  return asAdmin(async () => ({ ok: true, message: await deleteCompanyAsAdmin(Id.parse(companyId)) }));
}

/**
 * Cancels at the end of the current period: the status stays ACTIVE, so access lasts until
 * currentPeriodEnd and then ends on its own (access checks compare currentPeriodEnd with now).
 * Database only — it doesn't call Paddle. A Paddle subscription is really cancelled from Paddle,
 * and a later Paddle webhook may overwrite this flag.
 */
export async function cancelSubscription(subscriptionId: string) {
  return asAdmin(async () => {
    const id = Id.parse(subscriptionId);
    const { count } = await db.subscription.updateMany({ where: { id, status: "ACTIVE" }, data: { cancelAtPeriodEnd: true } });
    if (!count) return fail(k("admin.msg.subscriptionNotActive"));
    revalidatePath("/admin/subscriptions");
    return { ok: true, message: k("admin.msg.subscriptionCanceled") };
  });
}

// Only these public pages can be refreshed from the admin settings page.
const REVALIDATE_PATHS = ["/", "/jobs", "/premium", "/companies"] as const;

/** Clears the cached render of one public page, so the next visit is rebuilt from the database. */
export async function revalidatePathAction(path: string) {
  return asAdmin(async () => {
    const target = REVALIDATE_PATHS.find((p) => p === path);
    if (!target) return fail(k("admin.msg.pathNotAllowed"));
    revalidatePath(target);
    return { ok: true, message: k("admin.msg.revalidated", { path: target }) };
  });
}

const banReason = z.string().trim().max(300).optional().nullable().transform((v) => v || null);

/** Bans a member (signed out everywhere, can't sign in) or lifts the ban. */
export async function setUserBanned(userId: string, banned: boolean, reason?: string | null) {
  return asAdmin(async (admin) => ({
    ok: true,
    message: z.boolean().parse(banned) ? await banUserAsAdmin(admin.id, Id.parse(userId), banReason.parse(reason)) : await unbanUserAsAdmin(Id.parse(userId)),
  }));
}

/** Settles every open report on a post: deletes the post, or just dismisses the reports. */
export async function resolvePostReports(postId: string, deletePost: boolean) {
  return asAdmin(async () => ({ ok: true, message: await resolvePostReportsAsAdmin(Id.parse(postId), z.boolean().parse(deletePost)) }));
}
