import { NextResponse } from "next/server";
import { db, type Prisma } from "@/server/db";
import { ADMIN_PAGE, getMobileAdmin, listParams, noStore } from "@/server/mobile/admin";

export const dynamic = "force-dynamic";

const STATUSES = ["OPEN", "CLOSED", "DRAFT", "PAUSED"] as const;

// GET /api/mobile/admin/jobs?q=&status=OPEN|CLOSED|DRAFT|PAUSED&page=  →  { jobs, total, page, pageCount }
// Every job, newest first, 30 a page. Search by title or company name, as on the website.
export async function GET(req: Request) {
  const a = await getMobileAdmin(req);
  if ("error" in a) return a.error;
  const { sp, q, page, skip } = listParams(req);
  const status = STATUSES.find((s) => s === sp.get("status"));
  const where: Prisma.JobWhereInput = {
    ...(q && { OR: [{ title: { contains: q, mode: "insensitive" } }, { company: { name: { contains: q, mode: "insensitive" } } }] }),
    ...(status && { status }),
  };
  const now = new Date();
  const [jobs, total] = await Promise.all([
    db.job.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: ADMIN_PAGE,
      select: {
        id: true,
        title: true,
        status: true,
        createdAt: true,
        featuredUntil: true,
        urgentUntil: true,
        externalSource: true,
        applicationCount: true,
        company: { select: { name: true } },
        _count: { select: { reports: { where: { status: "OPEN" } } } },
      },
    }),
    db.job.count({ where }),
  ]);
  return NextResponse.json(
    {
      jobs: jobs.map((j) => ({
        id: j.id,
        title: j.title,
        status: j.status,
        company: j.company.name,
        applications: j.applicationCount,
        featured: !!j.featuredUntil && j.featuredUntil > now,
        urgent: !!j.urgentUntil && j.urgentUntil > now,
        imported: j.externalSource,
        openReports: j._count.reports,
        createdAt: j.createdAt.toISOString(),
      })),
      total,
      page,
      pageCount: Math.max(1, Math.ceil(total / ADMIN_PAGE)),
    },
    { headers: noStore },
  );
}
