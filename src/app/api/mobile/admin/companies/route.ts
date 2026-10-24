import { NextResponse } from "next/server";
import { db, type Prisma } from "@/server/db";
import { ADMIN_PAGE, getMobileAdmin, listParams, noStore } from "@/server/mobile/admin";

export const dynamic = "force-dynamic";

// GET /api/mobile/admin/companies?q=&filter=verified|unverified&page=  →  { companies, total, page, pageCount }
// Every company page, newest first, 30 a page. Search by name or address (slug), as on the website.
export async function GET(req: Request) {
  const a = await getMobileAdmin(req);
  if ("error" in a) return a.error;
  const { sp, q, page, skip } = listParams(req);
  const filter = sp.get("filter");
  const where: Prisma.CompanyWhereInput = {
    ...(q && { OR: [{ name: { contains: q, mode: "insensitive" } }, { slug: { contains: q, mode: "insensitive" } }] }),
    ...((filter === "verified" || filter === "unverified") && { verified: filter === "verified" }),
  };
  const [companies, total] = await Promise.all([
    db.company.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: ADMIN_PAGE,
      select: { id: true, name: true, slug: true, logoUrl: true, brandColor: true, verified: true, followerCount: true, createdAt: true, importSource: true, _count: { select: { jobs: true, members: true } } },
    }),
    db.company.count({ where }),
  ]);
  return NextResponse.json(
    {
      companies: companies.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        logoUrl: c.logoUrl,
        brandColor: c.brandColor,
        verified: c.verified,
        followers: c.followerCount,
        jobs: c._count.jobs,
        members: c._count.members,
        imported: !!c.importSource,
        createdAt: c.createdAt.toISOString(),
      })),
      total,
      page,
      pageCount: Math.max(1, Math.ceil(total / ADMIN_PAGE)),
    },
    { headers: noStore },
  );
}
