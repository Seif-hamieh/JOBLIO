import { NextResponse } from "next/server";
import type { MatchResult } from "@/lib/matching/engine";
import { LIMITS, rateLimit } from "@/server/rate-limit";
import { getApplicationDetail } from "@/server/services/recruiter";
import { markViewed } from "@/server/services/applications";
import { actionErrorResponse, getMobileRecruiter, mobileError } from "@/server/mobile/auth";

export const dynamic = "force-dynamic";

const iso = (d: Date | null) => (d ? d.toISOString() : null);

// GET /api/mobile/recruiter/applications/:id  →  { application }
// One applicant in full: their profile, match, note to the recruiter, whether a CV is attached, the stage history
// and the team's notes. Opening it marks the application viewed (the candidate sees "Viewed"), as on the website.
export async function GET(req: Request, { params }: RouteContext<"/api/mobile/recruiter/applications/[id]">) {
  const r = await getMobileRecruiter(req);
  if ("error" in r) return r.error;
  if (!rateLimit(`${LIMITS.search.key}:${r.userId}`, LIMITS.search.max, LIMITS.search.windowMs).ok) {
    return mobileError(429, "RATE_LIMITED", "Too many requests. Try again in a minute.");
  }
  const { id } = await params;
  const appId = id.slice(0, 40);
  try {
    await markViewed({ id: r.userId, companyId: r.companyId }, appId);
  } catch (e) {
    const refused = actionErrorResponse(e);
    if (refused) return refused;
    throw e;
  }
  const a = await getApplicationDetail(appId, r.companyId);
  if (!a) return mobileError(404, "NOT_FOUND", "This application doesn't exist.");
  const match = a.matchSnapshot as unknown as MatchResult | null;
  const p = a.applicant.profile;
  return NextResponse.json(
    {
      application: {
        id: a.id,
        status: a.status,
        stage: a.stage,
        rating: a.rating,
        appliedAt: a.createdAt.toISOString(),
        job: a.job,
        match: { score: a.matchScore, matchedSkills: match?.matchedSkills ?? [], missingSkills: match?.missingSkills ?? [] },
        coverLetter: a.coverLetter,
        hasResume: !!a.resumeUrl,
        candidate: {
          name: a.applicant.name,
          username: a.applicant.username,
          image: a.applicant.image,
          headline: p?.headline ?? null,
          city: p?.city ?? null,
          countryCode: p?.countryCode ?? null,
          yearsExperience: p?.yearsExperience ?? null,
          availability: p?.availability ?? null,
          openToWork: p?.openToWork ?? false,
          skills: p?.skills.map((s) => ({ name: s.skill.name, level: s.level })) ?? [],
          experience: p?.experiences.map((x) => ({ title: x.title, company: x.companyName, current: x.isCurrent, start: iso(x.startDate), end: iso(x.endDate) })) ?? [],
        },
        history: a.events.map((e) => ({ id: e.id, status: e.toStatus, stage: e.toStage, note: e.note, at: e.createdAt.toISOString(), by: e.actor?.name ?? null })),
        notes: a.notes.map((n) => ({ id: n.id, body: n.body, at: n.createdAt.toISOString(), by: n.author.name })),
        interviews: a.interviews.map((i) => ({ id: i.id, startsAt: i.startsAt.toISOString(), type: i.type, status: i.status, candidateResponse: i.candidateResponse })),
      },
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
