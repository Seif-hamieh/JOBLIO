import "server-only";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { ActionError } from "@/server/action";
import { checkAchievements } from "@/server/services/achievements";

// Following a company page, shared by the website's Follow button and the mobile API. Asking for the state you are
// already in changes nothing, so a repeated tap is harmless. Returns whether you follow it now.

export async function setCompanyFollow(userId: string, companyId: string, follow: boolean) {
  const key = { userId_companyId: { userId, companyId } };
  const existing = await db.companyFollower.findUnique({ where: key });
  if (!!existing === follow) return follow;
  if (existing) {
    await db.$transaction([db.companyFollower.delete({ where: key }), db.company.update({ where: { id: companyId }, data: { followerCount: { decrement: 1 } } })]);
  } else {
    const company = await db.company.findUnique({ where: { id: companyId }, select: { id: true } });
    if (!company) throw new ActionError("@msg.companyNotFound");
    await db.$transaction([db.companyFollower.create({ data: { userId, companyId } }), db.company.update({ where: { id: companyId }, data: { followerCount: { increment: 1 } } })]);
    await checkAchievements(userId, ["CAREER_EXPLORER"]);
  }
  revalidatePath("/companies");
  return follow;
}
