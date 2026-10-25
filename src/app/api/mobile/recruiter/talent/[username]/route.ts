import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { canMessageUser, canViewProfile } from "@/server/services/profile";
import { fullProfileSelect, recordProfileView } from "@/server/services/profile-page";
import { getMobileRecruiter, mobileError } from "@/server/mobile/auth";
import { hasRecruiterPro } from "@/server/mobile/messages";
import { toProfile } from "@/server/mobile/profile";

export const dynamic = "force-dynamic";

// GET /api/mobile/recruiter/talent/:username  →  { profile, saved, savedNote, applications, canMessage }
// A candidate seen from your company (the website's recruiter candidate page): their full profile, whether you saved
// them, and every application they sent to your company (each opens its pipeline card). Allowed when they applied
// to you, or when their profile is open to recruiters and visible to you. Counts as a profile view.
export async function GET(req: Request, { params }: RouteContext<"/api/mobile/recruiter/talent/[username]">) {
  const r = await getMobileRecruiter(req);
  if ("error" in r) return r.error;
  const { username } = await params;
  const user = await db.user.findUnique({
    where: { username: decodeURIComponent(username).slice(0, 40).toLowerCase() },
    select: {
      ...fullProfileSelect,
      profile: { select: { ...fullProfileSelect.profile.select, searchableByRecruiters: true } },
      applications: {
        where: { job: { companyId: r.companyId } },
        orderBy: { createdAt: "desc" },
        select: { id: true, status: true, stage: true, matchScore: true, createdAt: true, job: { select: { id: true, title: true } } },
      },
    },
  });
  if (!user?.profile) return mobileError(404, "NOT_FOUND", "This member doesn't exist.");
  const allowed = user.applications.length > 0 || (user.profile.searchableByRecruiters && (await canViewProfile(user.id, user.profile.visibility, r.userId)));
  if (!allowed) return mobileError(404, "NOT_FOUND", "This candidate isn't visible to recruiters.");

  const [me, company, saved, pro] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: r.userId }, select: { name: true } }),
    db.company.findUniqueOrThrow({ where: { id: r.companyId }, select: { id: true, name: true } }),
    db.savedCandidate.findUnique({ where: { recruiterId_candidateId: { recruiterId: r.userId, candidateId: user.id } }, select: { note: true } }),
    hasRecruiterPro(r.userId),
  ]);
  const [canMessage] = await Promise.all([
    canMessageUser({ id: r.userId, isRecruiter: true }, user.id),
    recordProfileView(user.id, { id: r.userId, name: me.name, company }),
  ]);
  return NextResponse.json(
    {
      profile: toProfile(user),
      saved: !!saved,
      savedNote: saved?.note ?? null,
      recruiterPro: pro,
      canMessage,
      applications: user.applications.map((a) => ({ id: a.id, status: a.status, stage: a.stage, matchScore: a.matchScore, appliedAt: a.createdAt.toISOString(), job: a.job })),
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
