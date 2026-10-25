import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { getMobileSession, mobileError } from "@/server/mobile/auth";

export const dynamic = "force-dynamic";

// GET /api/mobile/interviews  →  { upcoming, past }
// Interviews companies invited you to (the website's My Interviews): when, how (video / phone / on-site), the
// link or place, the recruiter's notes and your answer.
export async function GET(req: Request) {
  const session = await getMobileSession(req);
  if (!session) return mobileError(401, "UNAUTHORIZED", "Sign in first.");
  const rows = await db.interview.findMany({
    where: { application: { applicantId: session.user.id } },
    orderBy: { startsAt: "asc" },
    take: 100,
    select: {
      id: true,
      startsAt: true,
      durationMinutes: true,
      type: true,
      location: true,
      meetingUrl: true,
      notes: true,
      status: true,
      candidateResponse: true,
      scheduledBy: { select: { name: true, image: true } },
      application: { select: { job: { select: { id: true, title: true, company: { select: { name: true, slug: true, logoUrl: true, brandColor: true } } } } } },
    },
  });
  const now = new Date();
  const items = rows.map((i) => ({
    id: i.id,
    startsAt: i.startsAt.toISOString(),
    durationMinutes: i.durationMinutes,
    type: i.type,
    location: i.location,
    meetingUrl: i.meetingUrl,
    notes: i.notes,
    status: i.status,
    response: i.candidateResponse,
    scheduledBy: i.scheduledBy ? { name: i.scheduledBy.name, image: i.scheduledBy.image } : null,
    job: { id: i.application.job.id, title: i.application.job.title, company: i.application.job.company },
    upcoming: i.startsAt >= now && i.status === "SCHEDULED",
  }));
  return NextResponse.json(
    { upcoming: items.filter((i) => i.upcoming), past: items.filter((i) => !i.upcoming).reverse() },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
