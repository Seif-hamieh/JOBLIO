import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { getMobileAdmin, noStore } from "@/server/mobile/admin";

export const dynamic = "force-dynamic";

// Open reports, newest first, grouped by job (one row per reported job) — the website's Admin → Reports.
const MAX_REPORTS = 500;

// GET /api/mobile/admin/reports  →  { reports: [{ job, count, reasons, notes, latest }] }
export async function GET(req: Request) {
  const a = await getMobileAdmin(req);
  if ("error" in a) return a.error;
  const rows = await db.jobReport.findMany({
    where: { status: "OPEN" },
    orderBy: { createdAt: "desc" },
    take: MAX_REPORTS,
    select: {
      reason: true,
      details: true,
      createdAt: true,
      reporter: { select: { name: true } },
      job: { select: { id: true, title: true, status: true, externalSource: true, company: { select: { name: true } } } },
    },
  });
  type Group = { job: { id: string; title: string; status: string; company: string; imported: string | null }; count: number; reasons: Record<string, number>; notes: { text: string; by: string | null }[]; latest: string };
  const groups = new Map<string, Group>();
  for (const r of rows) {
    const g: Group = groups.get(r.job.id) ?? {
      job: { id: r.job.id, title: r.job.title, status: r.job.status, company: r.job.company.name, imported: r.job.externalSource },
      count: 0,
      reasons: {},
      notes: [],
      latest: r.createdAt.toISOString(),
    };
    g.count++;
    g.reasons[r.reason] = (g.reasons[r.reason] ?? 0) + 1;
    if (r.details && g.notes.length < 3) g.notes.push({ text: r.details, by: r.reporter?.name ?? null });
    groups.set(r.job.id, g);
  }
  return NextResponse.json({ reports: [...groups.values()] }, { headers: noStore });
}
