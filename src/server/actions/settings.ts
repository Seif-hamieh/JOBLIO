"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assessPassword } from "@/lib/password";
import { APIError } from "better-auth/api";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { fail, parse, withViewer, type ActionState } from "@/server/action";
import { LIMITS } from "@/server/rate-limit";
import { notificationSchema, updateNotificationSettings } from "@/server/services/settings";

export async function updateNotificationSettingsAction(input: z.input<typeof notificationSchema>): Promise<ActionState> {
  return withViewer({ limit: LIMITS.write }, async (viewer) => {
    const parsed = parse(notificationSchema, input);
    if (!parsed.success) return parsed.state;
    await updateNotificationSettings(viewer.id, parsed.data);
    revalidatePath("/settings");
    return { ok: true, message: "@msg.settingsSaved" };
  });
}

const passwordSchema = z
  .object({ currentPassword: z.string().min(1).max(128), newPassword: z.string().min(10).max(128) })
  .refine((v) => v.currentPassword !== v.newPassword, { path: ["newPassword"], message: "@v.invalid" });

/** Changes the password through Better Auth and signs out every other session. */
export async function changePasswordAction(input: z.input<typeof passwordSchema>): Promise<ActionState> {
  return withViewer({ limit: LIMITS.sensitive }, async (viewer) => {
    const parsed = parse(passwordSchema, input);
    if (!parsed.success) return parsed.state;
    // Same rule as sign-up and reset (also enforced by the auth hook).
    const weak = assessPassword(parsed.data.newPassword, [viewer.email, viewer.name]).problem;
    if (weak) return fail(`@auth.weak.${weak}`, { newPassword: [`@auth.weak.${weak}`] });
    try {
      await auth.api.changePassword({ body: { ...parsed.data, revokeOtherSessions: true }, headers: await headers() });
    } catch (e) {
      if (e instanceof APIError) return fail("@msg.wrongPassword", { currentPassword: ["@msg.wrongPassword"] });
      throw e;
    }
    revalidatePath("/settings/privacy");
    return { ok: true, message: "@msg.passwordChanged" };
  });
}

export async function revokeSessionAction(sessionId: string): Promise<ActionState> {
  return withViewer({ limit: LIMITS.write }, async (viewer) => {
    const id = z.string().min(1).max(64).parse(sessionId);
    // Only the viewer's own sessions can be revoked.
    await db.session.deleteMany({ where: { id, userId: viewer.id } });
    revalidatePath("/settings/privacy");
    return { ok: true, message: "@msg.sessionRevoked" };
  });
}

export async function revokeOtherSessionsAction(): Promise<ActionState> {
  return withViewer({ limit: LIMITS.write }, async () => {
    await auth.api.revokeOtherSessions({ headers: await headers() });
    revalidatePath("/settings/privacy");
    return { ok: true, message: "@msg.sessionRevoked" };
  });
}

/**
 * Permanently deletes the account. Jobs and interviews a recruiter created
 * belong to their company, so they are handed to another company admin
 * first; a sole owner must hand over (or delete) the workspace themselves.
 */
export async function deleteAccountAction(confirm: string): Promise<ActionState> {
  return withViewer({ limit: LIMITS.sensitive }, async (viewer) => {
    if (confirm !== "DELETE") return fail("@v.invalid", { confirm: ["@v.invalid"] });
    const [jobs, interviews] = await Promise.all([
      db.job.count({ where: { postedById: viewer.id } }),
      db.interview.count({ where: { scheduledById: viewer.id } }),
    ]);
    if (jobs || interviews) {
      const heir = viewer.company
        ? await db.companyMember.findFirst({
            where: { companyId: viewer.company.id, userId: { not: viewer.id }, role: { in: ["OWNER", "ADMIN"] } },
            select: { userId: true },
          })
        : null;
      if (!heir) return fail("@msg.deleteBlocked");
      await db.$transaction([
        db.job.updateMany({ where: { postedById: viewer.id }, data: { postedById: heir.userId } }),
        db.interview.updateMany({ where: { scheduledById: viewer.id }, data: { scheduledById: heir.userId } }),
      ]);
    }
    await db.user.delete({ where: { id: viewer.id } });
    return { ok: true, message: "@msg.accountDeleted" };
  });
}
