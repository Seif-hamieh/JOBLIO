import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/server/db";
import { LIMITS, rateLimit } from "@/server/rate-limit";
import { applyToJob } from "@/server/services/applications";
import { copyStored, deleteStored } from "@/server/storage";
import { actionErrorResponse, getMobileSession, mobileError } from "@/server/mobile/auth";

export const dynamic = "force-dynamic";

const body = z.object({
  coverLetter: z.string().trim().max(4000).optional().nullable(),
  // Attach the CV saved on the member's profile (a private copy, like the website does).
  useSavedResume: z.boolean().optional().default(true),
  // Answers to the job's screening questions, by question id: "YES"/"NO", a number, one of the options, or text.
  answers: z.record(z.string().max(40), z.union([z.string().max(1000), z.number(), z.null()])).optional(),
});

// POST /api/mobile/jobs/:id/apply  { coverLetter?, useSavedResume?, answers? }  →  201 { applied: true, score, resumeAttached }
// The same application flow as the website (applyToJob): open jobs only, not your own company's, once per job,
// imported jobs are applied to on their original site. Errors come back with the website's wording.
export async function POST(req: Request, { params }: RouteContext<"/api/mobile/jobs/[id]/apply">) {
  const session = await getMobileSession(req);
  if (!session) return mobileError(401, "UNAUTHORIZED", "Sign in first.");
  const userId = session.user.id;
  const limit = rateLimit(`${LIMITS.apply.key}:${userId}`, LIMITS.apply.max, LIMITS.apply.windowMs);
  if (!limit.ok) return mobileError(429, "RATE_LIMITED", `Too many applications. Try again in ${limit.retryAfterSeconds} s.`);
  const parsed = body.safeParse((await req.json().catch(() => ({}))) ?? {});
  if (!parsed.success) return mobileError(400, "INVALID_BODY", "The cover letter can be at most 4,000 characters.");
  const { id } = await params;
  const jobId = id.slice(0, 40);

  let resumeUrl: string | null = null;
  if (parsed.data.useSavedResume) {
    const saved = (await db.profile.findUnique({ where: { userId }, select: { resumeUrl: true } }))?.resumeUrl;
    if (saved) resumeUrl = await copyStored(saved);
  }
  try {
    const { match } = await applyToJob(userId, jobId, { coverLetter: parsed.data.coverLetter || null, resumeUrl, screeningAnswers: parsed.data.answers });
    revalidatePath(`/jobs/${jobId}`);
    revalidatePath("/applications");
    return NextResponse.json({ applied: true, score: match.score, resumeAttached: !!resumeUrl }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    await deleteStored([resumeUrl]);
    const refused = actionErrorResponse(e);
    if (refused) return refused;
    throw e;
  }
}
