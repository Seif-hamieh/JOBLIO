import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { getMobileAdmin, noStore } from "@/server/mobile/admin";

export const dynamic = "force-dynamic";

// Open reports, newest first, grouped by job or post (one entry each) — the website’s Admin → Reports.
const MAX_REPORTS = 500;

// GET /api/mobile/admin/reports  →  { reports: [{ job, count, reasons, notes, latest }], postReports: [{ post, … }] }
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
  return NextResponse.json({ reports: [...groups.values()], postReports: await reportedPosts() }, { headers: noStore });
}

type PostGroup = {
  post: { id: string; content: string; media: string[]; createdAt: string; author: { name: string; username: string | null; image: string | null } };
  count: number;
  reasons: Record<string, number>;
  notes: { text: string; by: string | null }[];
  latest: string;
};

/** Open post reports, newest first, one entry per reported post. */
async function reportedPosts() {
  const rows = await db.postReport.findMany({
    where: { status: "OPEN" },
    orderBy: { createdAt: "desc" },
    take: MAX_REPORTS,
    select: {
      reason: true,
      details: true,
      createdAt: true,
      reporter: { select: { name: true } },
      post: { select: { id: true, content: true, mediaUrls: true, createdAt: true, author: { select: { name: true, username: true, image: true } } } },
    },
  });
  const groups = new Map<string, PostGroup>();
  for (const r of rows) {
    const g: PostGroup = groups.get(r.post.id) ?? {
      post: { id: r.post.id, content: r.post.content, media: r.post.mediaUrls, createdAt: r.post.createdAt.toISOString(), author: r.post.author },
      count: 0,
      reasons: {},
      notes: [],
      latest: r.createdAt.toISOString(),
    };
    g.count++;
    g.reasons[r.reason] = (g.reasons[r.reason] ?? 0) + 1;
    if (r.details && g.notes.length < 3) g.notes.push({ text: r.details, by: r.reporter?.name ?? null });
    groups.set(r.post.id, g);
  }
  return [...groups.values()];
}
