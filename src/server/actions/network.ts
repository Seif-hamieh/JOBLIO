"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db";
import { fail, withViewer, type ActionState } from "@/server/action";
import { LIMITS } from "@/server/rate-limit";
import { notify } from "@/server/services/notifications";
import { k } from "@/i18n/message";
import { checkAchievements } from "@/server/services/achievements";
import { isBlockedEitherWay } from "@/server/services/profile";
import { removeConnection, requestConnection, respondToConnection } from "@/server/services/connections";

const id = z.string().min(1).max(64);

function refresh() {
  revalidatePath("/network");
  revalidatePath("/home");
}

export async function connectAction(userId: string, message?: string): Promise<ActionState> {
  return withViewer({ limit: LIMITS.connect }, async (viewer) => {
    const note = z.string().trim().max(300).optional().parse(message) || null;
    const result = await requestConnection(viewer, id.parse(userId), note);
    return { ok: true, message: result === "connected" ? "@msg.connected" : "@msg.requestSent" };
  });
}

export async function respondConnectionAction(connectionId: string, accept: boolean): Promise<ActionState> {
  return withViewer({ limit: LIMITS.write }, async (viewer) => {
    await respondToConnection(viewer, id.parse(connectionId), !!accept);
    return { ok: true, message: accept ? "@msg.connected" : "@msg.ignored" };
  });
}

/** Cancels an outgoing request or removes an existing connection. */
export async function removeConnectionAction(userId: string): Promise<ActionState> {
  return withViewer({ limit: LIMITS.write }, async (viewer) => {
    await removeConnection(viewer.id, id.parse(userId));
    return { ok: true };
  });
}

export async function toggleFollowUserAction(userId: string): Promise<ActionState<{ following: boolean }>> {
  return withViewer<{ following: boolean }>({ limit: LIMITS.write }, async (viewer) => {
    const other = id.parse(userId);
    if (other === viewer.id) return fail("@msg.followSelf");
    const key = { followerId_followingId: { followerId: viewer.id, followingId: other } };
    const existing = await db.follow.findUnique({ where: key });
    if (existing) await db.follow.delete({ where: key });
    else {
      if (await isBlockedEitherWay(viewer.id, other)) return fail("@msg.followBlocked");
      await db.follow.create({ data: { followerId: viewer.id, followingId: other } });
    }
    refresh();
    return { ok: true, data: { following: !existing } };
  });
}

export async function toggleBlockAction(userId: string): Promise<ActionState<{ blocked: boolean }>> {
  return withViewer<{ blocked: boolean }>({ limit: LIMITS.write }, async (viewer) => {
    const other = id.parse(userId);
    if (other === viewer.id) return fail("@msg.blockSelf");
    const key = { blockerId_blockedId: { blockerId: viewer.id, blockedId: other } };
    const existing = await db.block.findUnique({ where: key });
    if (existing) {
      await db.block.delete({ where: key });
    } else {
      await db.$transaction([
        db.block.create({ data: { blockerId: viewer.id, blockedId: other } }),
        // Blocking also removes any connection and follows between the two members.
        db.connection.deleteMany({ where: { OR: [{ requesterId: viewer.id, addresseeId: other }, { requesterId: other, addresseeId: viewer.id }] } }),
        db.follow.deleteMany({ where: { OR: [{ followerId: viewer.id, followingId: other }, { followerId: other, followingId: viewer.id }] } }),
      ]);
    }
    refresh();
    revalidatePath("/settings/privacy");
    return { ok: true, data: { blocked: !existing }, message: existing ? "@msg.unblocked" : "@msg.blocked" };
  });
}

export async function endorseSkillAction(userSkillId: string): Promise<ActionState<{ endorsed: boolean; count: number }>> {
  return withViewer<{ endorsed: boolean; count: number }>({ limit: LIMITS.write }, async (viewer) => {
    const usId = id.parse(userSkillId);
    const us = await db.userSkill.findUnique({ where: { id: usId }, select: { id: true, profile: { select: { userId: true } }, skill: { select: { name: true } } } });
    if (!us) return fail("@msg.skillNotFound");
    const owner = us.profile.userId;
    if (owner === viewer.id) return fail("@msg.endorseOwn");
    const connected = await db.connection.findFirst({
      where: { status: "ACCEPTED", OR: [{ requesterId: viewer.id, addresseeId: owner }, { requesterId: owner, addresseeId: viewer.id }] },
      select: { id: true },
    });
    if (!connected) return fail("@msg.connectFirst");

    const key = { userSkillId_endorserId: { userSkillId: usId, endorserId: viewer.id } };
    const existing = await db.endorsement.findUnique({ where: key });
    const [, updated] = await db.$transaction([
      existing ? db.endorsement.delete({ where: key }) : db.endorsement.create({ data: { userSkillId: usId, endorserId: viewer.id } }),
      db.userSkill.update({ where: { id: usId }, data: { endorsementCount: { [existing ? "decrement" : "increment"]: 1 } }, select: { endorsementCount: true } }),
    ]);
    if (!existing) {
      await notify({
        userId: owner,
        actorId: viewer.id,
        type: "SKILL_ENDORSEMENT",
        title: k("notif.endorsement", { name: viewer.name, skill: us.skill.name }),
        href: `/profile/skills`,
      });
      await checkAchievements(owner, ["TOP_SKILL"]);
    }
    return { ok: true, data: { endorsed: !existing, count: updated.endorsementCount } };
  });
}
