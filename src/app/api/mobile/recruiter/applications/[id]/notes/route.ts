import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/server/db";
import { LIMITS, rateLimit } from "@/server/rate-limit";
import { getManagedApplication } from "@/server/services/applications";
import { actionErrorResponse, getMobileRecruiter, mobileError } from "@/server/mobile/auth";

export const dynamic = "force-dynamic";

const body = z.object({ body: z.string().trim().min(1).max(2000) });

// POST /api/mobile/recruiter/applications/:id/notes  { body }  →  201 { note }
// A private note for the hiring team (the candidate never sees it), as on the website.
export async function POST(req: Request, { params }: RouteContext<"/api/mobile/recruiter/applications/[id]/notes">) {
  const r = await getMobileRecruiter(req);
  if ("error" in r) return r.error;
  if (!rateLimit(`${LIMITS.write.key}:${r.userId}`, LIMITS.write.max, LIMITS.write.windowMs).ok) {
    return mobileError(429, "RATE_LIMITED", "Too many requests. Try again in a minute.");
  }
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return mobileError(400, "INVALID_BODY", "Write a note (up to 2,000 characters).");
  const { id } = await params;
  try {
    const app = await getManagedApplication(r.companyId, id.slice(0, 40));
    const note = await db.recruiterNote.create({
      data: { applicationId: app.id, authorId: r.userId, body: parsed.data.body },
      select: { id: true, body: true, createdAt: true, author: { select: { name: true } } },
    });
    return NextResponse.json(
      { note: { id: note.id, body: note.body, at: note.createdAt.toISOString(), by: note.author.name } },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    const refused = actionErrorResponse(e);
    if (refused) return refused;
    throw e;
  }
}
