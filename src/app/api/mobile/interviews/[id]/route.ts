import { NextResponse } from "next/server";
import { z } from "zod";
import { LIMITS, rateLimit } from "@/server/rate-limit";
import { respondToInterview } from "@/server/services/interviews";
import { actionErrorResponse, getMobileSession, mobileError } from "@/server/mobile/auth";
import { resolveMessage } from "@/i18n/message";
import { createT } from "@/i18n/translate";

export const dynamic = "force-dynamic";

const body = z.object({ response: z.enum(["ACCEPTED", "DECLINED"]) });

// POST /api/mobile/interviews/:id  { response: "ACCEPTED" | "DECLINED" }  →  { response, message }
// Accept or decline an interview invitation; the recruiter who scheduled it is told.
export async function POST(req: Request, { params }: RouteContext<"/api/mobile/interviews/[id]">) {
  const session = await getMobileSession(req);
  if (!session) return mobileError(401, "UNAUTHORIZED", "Sign in first.");
  if (!rateLimit(`${LIMITS.write.key}:${session.user.id}`, LIMITS.write.max, LIMITS.write.windowMs).ok) return mobileError(429, "RATE_LIMITED", "Slow down a little.");
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return mobileError(400, "INVALID_BODY", "Choose ACCEPTED or DECLINED.");
  const { id } = await params;
  try {
    const message = await respondToInterview({ id: session.user.id, name: session.user.name }, id.slice(0, 40), parsed.data.response);
    return NextResponse.json({ response: parsed.data.response, message: resolveMessage(createT("en"), message) }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    const refused = actionErrorResponse(e);
    if (refused) return refused;
    throw e;
  }
}
