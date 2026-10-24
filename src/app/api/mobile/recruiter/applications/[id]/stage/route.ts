import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { PIPELINE_STAGES } from "@/lib/constants";
import { rateLimit } from "@/server/rate-limit";
import { transitionApplication } from "@/server/services/applications";
import { actionErrorResponse, getMobileRecruiter, mobileError } from "@/server/mobile/auth";

export const dynamic = "force-dynamic";

const body = z.object({
  stage: z.enum(PIPELINE_STAGES),
  // Moving someone out of Hired tells them their status changed: the app asks for confirmation first.
  leaveHired: z.boolean().optional().default(false),
});

// POST /api/mobile/recruiter/applications/:id/stage  { stage, leaveHired? }  →  { status, stage }
// Moves a candidate to another column (to the end of it), exactly like dragging a card on the website: the
// candidate's status follows the stage, the move is logged and the candidate is notified.
export async function POST(req: Request, { params }: RouteContext<"/api/mobile/recruiter/applications/[id]/stage">) {
  const r = await getMobileRecruiter(req);
  if ("error" in r) return r.error;
  if (!rateLimit(`pipeline:${r.userId}`, 120, 60_000).ok) return mobileError(429, "RATE_LIMITED", "Too many requests. Try again in a minute.");
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return mobileError(400, "INVALID_BODY", `Send { stage } with one of ${PIPELINE_STAGES.join(", ")}.`);
  const { id } = await params;
  try {
    const result = await transitionApplication({ id: r.userId, companyId: r.companyId }, id.slice(0, 40), {
      stage: parsed.data.stage,
      position: Date.now(),
      leaveHired: parsed.data.leaveHired,
    });
    revalidatePath("/recruiter", "layout");
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    const refused = actionErrorResponse(e);
    if (refused) return refused;
    throw e;
  }
}
