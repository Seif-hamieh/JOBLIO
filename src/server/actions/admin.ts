"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db";
import { fail, withViewer, type ActionState } from "@/server/action";
import { LIMITS } from "@/server/rate-limit";
import { k } from "@/i18n/message";
import type { Viewer } from "@/server/session";

// Admin-only mutations. Each one re-checks the role from the database (getViewer) —
// hiding buttons in the UI is not a security boundary.

function asAdmin<R>(fn: (admin: Viewer) => Promise<ActionState<R>>): Promise<ActionState<R>> {
  return withViewer({ limit: LIMITS.write }, async (viewer) => {
    if (!viewer.isAdmin) return fail(k("admin.msg.forbidden"));
    return fn(viewer);
  });
}

const Id = z.string().min(1).max(64);

export async function setUserRole(userId: string, role: "USER" | "ADMIN") {
  return asAdmin(async (admin) => {
    const id = Id.parse(userId);
    const next = z.enum(["USER", "ADMIN"]).parse(role);
    if (id === admin.id) return fail(k("admin.msg.notSelf"));
    const { count } = await db.user.updateMany({ where: { id }, data: { platformRole: next } });
    if (!count) return fail(k("admin.msg.userNotFound"));
    revalidatePath("/admin/users");
    return { ok: true, message: k(next === "ADMIN" ? "admin.msg.adminGranted" : "admin.msg.adminRevoked") };
  });
}

export async function closeJob(jobId: string) {
  return asAdmin(async () => {
    const id = Id.parse(jobId);
    const { count } = await db.job.updateMany({ where: { id }, data: { status: "CLOSED" } });
    if (!count) return fail(k("admin.msg.jobNotFound"));
    revalidatePath("/admin/jobs");
    return { ok: true, message: k("admin.msg.jobClosed") };
  });
}

/** Permanent: the job's applications, saves and stats are deleted with it (cascade). */
export async function deleteJob(jobId: string) {
  return asAdmin(async () => {
    const id = Id.parse(jobId);
    const { count } = await db.job.deleteMany({ where: { id } });
    if (!count) return fail(k("admin.msg.jobNotFound"));
    revalidatePath("/admin/jobs");
    return { ok: true, message: k("admin.msg.jobDeleted") };
  });
}
