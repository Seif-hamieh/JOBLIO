"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db";
import { withViewer, type ActionState } from "@/server/action";

export async function markNotificationReadAction(notificationId: string): Promise<ActionState> {
  return withViewer({}, async (viewer) => {
    await db.notification.updateMany({ where: { id: z.string().max(40).parse(notificationId), userId: viewer.id, readAt: null }, data: { readAt: new Date() } });
    return { ok: true };
  });
}

export async function markAllNotificationsReadAction(): Promise<ActionState> {
  return withViewer({}, async (viewer) => {
    await db.notification.updateMany({ where: { userId: viewer.id, readAt: null }, data: { readAt: new Date() } });
    revalidatePath("/notifications");
    return { ok: true, message: "@msg.caughtUp" };
  });
}
