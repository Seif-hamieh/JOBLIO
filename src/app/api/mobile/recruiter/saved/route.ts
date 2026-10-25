import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { FREE_SAVED_CANDIDATES } from "@/server/services/saved-candidates";
import { getMobileRecruiter } from "@/server/mobile/auth";
import { hasRecruiterPro } from "@/server/mobile/messages";

export const dynamic = "force-dynamic";

// GET /api/mobile/recruiter/saved  →  { candidates, limit }
// The candidates you saved for later (your talent list), newest first, with your note. limit is null with
// Recruiter Pro (unlimited), otherwise the free 10.
export async function GET(req: Request) {
  const r = await getMobileRecruiter(req);
  if ("error" in r) return r.error;
  const [saved, pro] = await Promise.all([
    db.savedCandidate.findMany({
      where: { recruiterId: r.userId },
      orderBy: { createdAt: "desc" },
      select: {
        note: true,
        createdAt: true,
        candidate: {
          select: {
            id: true,
            name: true,
            image: true,
            username: true,
            profile: { select: { headline: true, city: true, countryCode: true, openToWork: true, skills: { where: { isTop: true }, take: 3, select: { skill: { select: { name: true } } } } } },
            applications: { where: { job: { companyId: r.companyId } }, orderBy: { createdAt: "desc" }, take: 3, select: { id: true, status: true, job: { select: { title: true } } } },
          },
        },
      },
    }),
    hasRecruiterPro(r.userId),
  ]);
  return NextResponse.json(
    {
      candidates: saved.map((s) => ({
        id: s.candidate.id,
        name: s.candidate.name,
        image: s.candidate.image,
        username: s.candidate.username,
        headline: s.candidate.profile?.headline ?? null,
        city: s.candidate.profile?.city ?? null,
        countryCode: s.candidate.profile?.countryCode ?? null,
        openToWork: s.candidate.profile?.openToWork ?? false,
        topSkills: s.candidate.profile?.skills.map((x) => x.skill.name) ?? [],
        note: s.note,
        savedAt: s.createdAt.toISOString(),
        // Their applications to your company, so the pipeline is one tap away.
        applications: s.candidate.applications.map((a) => ({ id: a.id, status: a.status, job: a.job.title })),
      })),
      limit: pro ? null : FREE_SAVED_CANDIDATES,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
