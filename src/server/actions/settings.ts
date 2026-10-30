"use server";

import { deleteAccount } from "@/server/services/account-deletion";
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
 * Permanently deletes the account and its files (see deleteAccount).
 */
export async function deleteAccountAction(confirm: string): Promise<ActionState> {
  return withViewer({ limit: LIMITS.sensitive }, async (viewer) => {
    if (confirm !== "DELETE") return fail("@v.invalid", { confirm: ["@v.invalid"] });
    if ((await deleteAccount(viewer.id, viewer.company?.id ?? null)) === "blocked") return fail("@msg.deleteBlocked");
    return { ok: true, message: "@msg.accountDeleted" };
  });
}
