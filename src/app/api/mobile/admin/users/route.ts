import { NextResponse } from "next/server";
import { db, type Prisma } from "@/server/db";
import { ADMIN_PAGE, getMobileAdmin, listParams, noStore } from "@/server/mobile/admin";

export const dynamic = "force-dynamic";

// GET /api/mobile/admin/users?q=&filter=admins|recruiters|seekers|banned&page=  →  { users, total, page, pageCount }
// Every member, newest first, 30 a page. Search by name, email or username (as on the website). Recruiters are
// members of a company; job seekers are everyone else.
export async function GET(req: Request) {
  const a = await getMobileAdmin(req);
  if ("error" in a) return a.error;
  const { sp, q, page, skip } = listParams(req);
  const filter = sp.get("filter");
  const where: Prisma.UserWhereInput = {
    ...(q && { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }, { username: { contains: q, mode: "insensitive" } }] }),
    ...(filter === "admins" && { platformRole: "ADMIN" }),
    ...(filter === "recruiters" && { companyMemberships: { some: {} } }),
    ...(filter === "seekers" && { companyMemberships: { none: {} } }),
    ...(filter === "banned" && { bannedAt: { not: null } }),
  };
  const [users, total] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: ADMIN_PAGE,
      select: {
        id: true,
        name: true,
        email: true,
        username: true,
        image: true,
        platformRole: true,
        intent: true,
        emailVerified: true,
        bannedAt: true,
        bannedReason: true,
        createdAt: true,
        companyMemberships: { take: 1, select: { company: { select: { name: true } } } },
      },
    }),
    db.user.count({ where }),
  ]);
  return NextResponse.json(
    {
      users: users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        username: u.username,
        image: u.image,
        admin: u.platformRole === "ADMIN",
        intent: u.intent,
        verified: u.emailVerified,
        company: u.companyMemberships[0]?.company.name ?? null,
        joinedAt: u.createdAt.toISOString(),
        banned: !!u.bannedAt,
        bannedAt: u.bannedAt?.toISOString() ?? null,
        bannedReason: u.bannedReason,
        self: u.id === a.adminId,
      })),
      total,
      page,
      pageCount: Math.max(1, Math.ceil(total / ADMIN_PAGE)),
    },
    { headers: noStore },
  );
}
