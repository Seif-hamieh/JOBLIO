import "server-only";
import { k } from "@/i18n/message";
import { db, type Prisma } from "@/server/db";

export const personCardSelect = {
  id: true,
  name: true,
  image: true,
  username: true,
  profile: {
    select: {
      headline: true,
      city: true,
      countryCode: true,
      openToWork: true,
      featuredUntil: true,
      skills: { where: { isTop: true }, take: 3, orderBy: { position: "asc" }, select: { skill: { select: { name: true } } } },
    },
  },
} satisfies Prisma.UserSelect;

export type PersonCard = Prisma.UserGetPayload<{ select: typeof personCardSelect }>;

export async function connectionIds(userId: string) {
  const rows = await db.connection.findMany({
    where: { status: "ACCEPTED", OR: [{ requesterId: userId }, { addresseeId: userId }] },
    select: { requesterId: true, addresseeId: true },
  });
  return rows.map((r) => (r.requesterId === userId ? r.addresseeId : r.requesterId));
}

export type RelationState = "self" | "connected" | "pending-out" | "pending-in" | "none";

export async function relationStates(viewerId: string, others: string[]) {
  const rows = await db.connection.findMany({
    where: {
      OR: [
        { requesterId: viewerId, addresseeId: { in: others } },
        { addresseeId: viewerId, requesterId: { in: others } },
      ],
      status: { in: ["PENDING", "ACCEPTED"] },
    },
    select: { requesterId: true, addresseeId: true, status: true, id: true },
  });
  const map = new Map<string, { state: RelationState; connectionId?: string }>();
  for (const id of others) map.set(id, { state: id === viewerId ? "self" : "none" });
  for (const r of rows) {
    const other = r.requesterId === viewerId ? r.addresseeId : r.requesterId;
    map.set(other, {
      state: r.status === "ACCEPTED" ? "connected" : r.requesterId === viewerId ? "pending-out" : "pending-in",
      connectionId: r.id,
    });
  }
  return map;
}

/**
 * People you may know — fully rule-based:
 *   +4 per mutual connection, +2 per shared skill (max 5), +3 same city,
 *   +1 same country, +2 same current company.
 */
export async function suggestions(userId: string, take = 6) {
  const [mine, me] = await Promise.all([
    connectionIds(userId),
    db.profile.findUnique({
      where: { userId },
      select: { city: true, countryCode: true, skills: { select: { skillId: true } }, experiences: { where: { isCurrent: true }, select: { companyId: true } } },
    }),
  ]);
  const pending = await db.connection.findMany({
    where: { OR: [{ requesterId: userId }, { addresseeId: userId }] },
    select: { requesterId: true, addresseeId: true },
  });
  const blocked = await db.block.findMany({ where: { OR: [{ blockerId: userId }, { blockedId: userId }] }, select: { blockerId: true, blockedId: true } });
  const exclude = new Set([userId, ...pending.flatMap((p) => [p.requesterId, p.addresseeId]), ...blocked.flatMap((b) => [b.blockerId, b.blockedId])]);

  const skillIds = me?.skills.map((s) => s.skillId) ?? [];
  const companyIds = (me?.experiences.map((e) => e.companyId).filter(Boolean) as string[]) ?? [];

  // Candidate pool: friends-of-friends plus people sharing skills, city or company.
  const [fof, similar] = await Promise.all([
    mine.length
      ? db.connection.findMany({
          where: { status: "ACCEPTED", OR: [{ requesterId: { in: mine } }, { addresseeId: { in: mine } }] },
          select: { requesterId: true, addresseeId: true },
          take: 2000,
        })
      : [],
    db.user.findMany({
      where: {
        id: { notIn: [...exclude] },
        profile: {
          visibility: { not: "CONNECTIONS" },
          OR: [
            ...(skillIds.length ? [{ skills: { some: { skillId: { in: skillIds } } } }] : []),
            ...(me?.city ? [{ city: { equals: me.city, mode: "insensitive" as const } }] : []),
            ...(companyIds.length ? [{ experiences: { some: { companyId: { in: companyIds }, isCurrent: true } } }] : []),
          ],
        },
      },
      select: { id: true },
      take: 150,
    }),
  ]);

  const mutual = new Map<string, number>();
  const mineSet = new Set(mine);
  for (const c of fof) {
    for (const [a, b] of [
      [c.requesterId, c.addresseeId],
      [c.addresseeId, c.requesterId],
    ] as const) {
      if (mineSet.has(a) && !exclude.has(b)) mutual.set(b, (mutual.get(b) ?? 0) + 1);
    }
  }
  const poolIds = [...new Set([...mutual.keys(), ...similar.map((s) => s.id)])].slice(0, 200);
  if (!poolIds.length) return [];

  const pool = await db.user.findMany({
    where: { id: { in: poolIds } },
    select: {
      ...personCardSelect,
      profile: {
        select: {
          ...personCardSelect.profile.select,
          skills: { select: { skillId: true, isTop: true, position: true, skill: { select: { name: true } } } },
          experiences: { where: { isCurrent: true }, select: { companyId: true } },
        },
      },
    },
  });
  const mySkills = new Set(skillIds);
  const scored = pool.map((u) => {
    const p = u.profile;
    const shared = p ? p.skills.filter((s) => mySkills.has(s.skillId)).length : 0;
    const m = mutual.get(u.id) ?? 0;
    let score = m * 4 + Math.min(shared, 5) * 2;
    const reasons: string[] = [];
    if (m) reasons.push(k("network.reasonMutual", { n: m }));
    if (p?.city && me?.city && p.city.toLowerCase() === me.city.toLowerCase()) {
      score += 3;
      reasons.push(k("network.reasonCity", { city: p.city }));
    } else if (p?.countryCode && p.countryCode === me?.countryCode) score += 1;
    if (p?.experiences.some((e) => e.companyId && companyIds.includes(e.companyId))) {
      score += 2;
      reasons.push(k("network.reasonCompany"));
    }
    if (shared && reasons.length < 2) reasons.push(k("network.reasonSkills", { n: shared }));
    const topSkills = p ? [...p.skills].sort((a, b) => a.position - b.position).filter((s) => s.isTop).slice(0, 3) : [];
    return { user: { ...u, profile: p ? { ...p, skills: topSkills } : null }, score, reason: reasons[0] ?? k("network.reasonDefault"), mutual: m };
  });
  return scored.sort((a, b) => b.score - a.score).slice(0, take);
}

export async function networkStats(userId: string) {
  const [connections, followers, following, companies] = await Promise.all([
    db.connection.count({ where: { status: "ACCEPTED", OR: [{ requesterId: userId }, { addresseeId: userId }] } }),
    db.follow.count({ where: { followingId: userId } }),
    db.follow.count({ where: { followerId: userId } }),
    db.companyFollower.count({ where: { userId } }),
  ]);
  return { connections, followers, following, companies };
}
