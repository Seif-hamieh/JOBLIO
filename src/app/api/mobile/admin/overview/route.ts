import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { getMobileAdmin, noStore } from "@/server/mobile/admin";

export const dynamic = "force-dynamic";

// GET /api/mobile/admin/overview  →  { stats, recentUsers, recentJobs }
// The website's admin dashboard: platform totals, open reports, the newest members and jobs.
export async function GET(req: Request) {
  const a = await getMobileAdmin(req);
  if ("error" in a) return a.error;
  const [users, admins, companies, verifiedCompanies, jobs, openJobs, draftJobs, applications, activeSubscriptions, payments, openReports, reportedJobs, recentUsers, recentJobs] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { platformRole: "ADMIN" } }),
    db.company.count(),
    db.company.count({ where: { verified: true } }),
    db.job.count(),
    db.job.count({ where: { status: "OPEN" } }),
    db.job.count({ where: { status: "DRAFT" } }),
    db.application.count(),
    db.subscription.count({ where: { status: "ACTIVE" } }),
    db.payment.count({ where: { status: "SUCCEEDED" } }),
    db.jobReport.count({ where: { status: "OPEN" } }),
    db.jobReport.groupBy({ by: ["jobId"], where: { status: "OPEN" } }).then((g) => g.length),
    db.user.findMany({ orderBy: { createdAt: "desc" }, take: 5, select: { id: true, name: true, email: true, image: true, username: true, platformRole: true, createdAt: true } }),
    db.job.findMany({ orderBy: { createdAt: "desc" }, take: 5, select: { id: true, title: true, status: true, createdAt: true, company: { select: { name: true } } } }),
  ]);
  return NextResponse.json(
    {
      stats: { users, admins, companies, verifiedCompanies, jobs, openJobs, draftJobs, applications, activeSubscriptions, payments, openReports, reportedJobs },
      recentUsers: recentUsers.map((u) => ({ ...u, admin: u.platformRole === "ADMIN", platformRole: undefined, createdAt: u.createdAt.toISOString() })),
      recentJobs: recentJobs.map((j) => ({ id: j.id, title: j.title, status: j.status, company: j.company.name, createdAt: j.createdAt.toISOString() })),
    },
    { headers: noStore },
  );
}
