import "server-only";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { ActionError } from "@/server/action";
import { notify } from "@/server/services/notifications";
import { checkAchievements } from "@/server/services/achievements";
import { isBlockedEitherWay } from "@/server/services/profile";
import { k } from "@/i18n/message";

// Connection requests, shared by the website's network actions and the mobile API. Rule breaks throw ActionError
// with an encoded message key; each caller turns that into its own response.

type Viewer = { id: string; name: string; username: string; headline?: string | null };

function refresh() {
  revalidatePath("/network");
  revalidatePath("/home");
}

/** Sends a request (with an optional note), or accepts theirs if they already asked. */
export async function requestConnection(viewer: Viewer, other: string, note: string | null): Promise<"sent" | "connected"> {
  if (other === viewer.id) throw new ActionError("@msg.connectSelf");
  if (await isBlockedEitherWay(viewer.id, other)) throw new ActionError("@msg.connectBlocked");
  const target = await db.user.findUnique({ where: { id: other }, select: { id: true } });
  if (!target) throw new ActionError("@msg.memberNotFound");

  const existing = await db.connection.findFirst({
    where: { OR: [{ requesterId: viewer.id, addresseeId: other }, { requesterId: other, addresseeId: viewer.id }] },
  });
  if (existing?.status === "ACCEPTED") throw new ActionError("@msg.alreadyConnected");
  if (existing?.status === "PENDING" && existing.requesterId === other) {
    // They already asked us — accept instead of creating a second request.
    await respondToConnection(viewer, existing.id, true);
    return "connected";
  }
  if (existing?.status === "PENDING") throw new ActionError("@msg.requestAlready");
  if (existing) await db.connection.delete({ where: { id: existing.id } });

  await db.connection.create({ data: { requesterId: viewer.id, addresseeId: other, message: note } });
  const headline = viewer.headline !== undefined ? viewer.headline : (await db.profile.findUnique({ where: { userId: viewer.id }, select: { headline: true } }))?.headline;
  await notify({
    userId: other,
    actorId: viewer.id,
    type: "CONNECTION_REQUEST",
    title: k("notif.connectionRequest", { name: viewer.name }),
    body: note ?? headline ?? undefined,
    href: "/network",
  });
  refresh();
  return "sent";
}

/** Accepts or ignores a request sent to the viewer. */
export async function respondToConnection(viewer: Viewer, connectionId: string, accept: boolean) {
  const c = await db.connection.findUnique({ where: { id: connectionId } });
  if (!c || c.addresseeId !== viewer.id || c.status !== "PENDING") throw new ActionError("@msg.requestNotFound");
  await db.connection.update({ where: { id: c.id }, data: { status: accept ? "ACCEPTED" : "DECLINED", respondedAt: new Date() } });
  if (accept) {
    await notify({
      userId: c.requesterId,
      actorId: viewer.id,
      type: "CONNECTION_ACCEPTED",
      title: k("notif.connectionAccepted", { name: viewer.name }),
      href: `/in/${viewer.username}`,
    });
    await Promise.all([checkAchievements(viewer.id, ["NETWORK_BUILDER"]), checkAchievements(c.requesterId, ["NETWORK_BUILDER"])]);
  }
  refresh();
}

/** Cancels an outgoing request or removes an existing connection. */
export async function removeConnection(viewerId: string, other: string) {
  await db.connection.deleteMany({
    where: { OR: [{ requesterId: viewerId, addresseeId: other }, { requesterId: other, addresseeId: viewerId, status: "ACCEPTED" }] },
  });
  refresh();
}
