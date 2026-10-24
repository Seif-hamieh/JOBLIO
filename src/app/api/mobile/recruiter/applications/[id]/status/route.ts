import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { LIMITS, rateLimit } from "@/server/rate-limit";
import { transitionApplication } from "@/server/services/applications";
import { actionErrorResponse, getMobileRecruiter, mobileError } from "@/server/mobile/auth";

export const dynamic = "force-dynamic";

const body = z.object({
  status: z.enum(["OFFER", "REJECTED"]),
  note: z.string().trim().max(500).optional().nullable(),
});

// POST /api/mobile/recruiter/applications/:id/status  { status: "OFFER" | "REJECTED", note? }  →  { status, stage }
// Records an offer (the card moves to Final) or declines the candidate, as on the website (a hired candidate can't
// be declined without being moved out of Hired first). The candidate is notified.
export async function POST(req: Request, { params }: RouteContext<"/api/mobile/recruiter/applications/[id]/status">) {
  const r = await getMobileRecruiter(req);
  if ("error" in r) return r.error;
  if (!rateLimit(`${LIMITS.write.key}:${r.userId}`, LIMITS.write.max, LIMITS.write.windowMs).ok) {
    return mobileError(429, "RATE_LIMITED", "Too many requests. Try again in a minute.");
  }
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return mobileError(400, "INVALID_BODY", 'Send { status: "OFFER" | "REJECTED", note? }.');
  const { id } = await params;
  try {
    const result = await transitionApplication({ id: r.userId, companyId: r.companyId }, id.slice(0, 40), {
      status: parsed.data.status,
      stage: parsed.data.status === "OFFER" ? "FINAL" : undefined,
      note: parsed.data.note || null,
    });
    revalidatePath("/recruiter", "layout");
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    const refused = actionErrorResponse(e);
    if (refused) return refused;
    throw e;
  }
}
