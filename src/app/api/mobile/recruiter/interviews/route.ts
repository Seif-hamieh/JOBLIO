import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { scheduleInterview, scheduleSchema } from "@/server/services/interviews";
import { getMobileRecruiter } from "@/server/mobile/auth";
import { invalidFields, recruiterChange } from "@/server/mobile/recruiter";

export const dynamic = "force-dynamic";

// GET /api/mobile/recruiter/interviews  →  { upcoming, past }
// Your company's interviews across all its jobs (the website's recruiter Interviews page: from a week ago on, 100 at
// most), with the candidate, the job, the place or link, the notes and the candidate's answer.
export async function GET(req: Request) {
  const r = await getMobileRecruiter(req);
  if ("error" in r) return r.error;
  const rows = await db.interview.findMany({
    where: { application: { job: { companyId: r.companyId } }, startsAt: { gte: new Date(Date.now() - 7 * 86_400_000) } },
    orderBy: { startsAt: "asc" },
    take: 100,
    select: {
      id: true,
      startsAt: true,
      durationMinutes: true,
      type: true,
      status: true,
      candidateResponse: true,
      meetingUrl: true,
      location: true,
      notes: true,
      scheduledBy: { select: { name: true } },
      application: { select: { id: true, applicant: { select: { name: true, image: true, username: true } }, job: { select: { id: true, title: true } } } },
    },
  });
  const now = new Date();
  const items = rows.map((i) => ({
    id: i.id,
    startsAt: i.startsAt.toISOString(),
    durationMinutes: i.durationMinutes,
    type: i.type,
    status: i.status,
    response: i.candidateResponse,
    meetingUrl: i.meetingUrl,
    location: i.location,
    notes: i.notes,
    scheduledBy: i.scheduledBy?.name ?? null,
    applicationId: i.application.id,
    candidate: i.application.applicant,
    job: i.application.job,
    upcoming: i.startsAt >= now && i.status === "SCHEDULED",
  }));
  return NextResponse.json({ upcoming: items.filter((i) => i.upcoming), past: items.filter((i) => !i.upcoming).reverse() }, { headers: { "Cache-Control": "private, no-store" } });
}

// POST /api/mobile/recruiter/interviews  { applicationId, startsAt, durationMinutes, type, location?, meetingUrl?, notes? }
//   →  { message }
// Invites an applicant to an interview (the website's "Schedule interview"): the application moves to Interview and
// the candidate is notified. The meeting link must start with https://.
export async function POST(req: Request) {
  const parsed = scheduleSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return invalidFields(parsed.error.issues, "Check the date, length and link.");
  return recruiterChange(req, (r) => scheduleInterview({ id: r.userId, companyId: r.companyId }, parsed.data));
}
