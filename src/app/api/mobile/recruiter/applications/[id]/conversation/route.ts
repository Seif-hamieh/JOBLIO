import { NextResponse } from "next/server";
import { LIMITS, rateLimit } from "@/server/rate-limit";
import { getManagedApplication } from "@/server/services/applications";
import { ensureConversation } from "@/server/services/messaging";
import { actionErrorResponse, getMobileRecruiter, mobileError } from "@/server/mobile/auth";
import { hasRecruiterPro } from "@/server/mobile/messages";

export const dynamic = "force-dynamic";

// POST /api/mobile/recruiter/applications/:id/conversation  →  { conversationId }
// "Message candidate": opens (or reuses) the 1:1 conversation with someone who applied to the company. The
// website's rules apply: the candidate's message settings, blocks, and the monthly limit on new conversations.
export async function POST(req: Request, { params }: RouteContext<"/api/mobile/recruiter/applications/[id]/conversation">) {
  const r = await getMobileRecruiter(req);
  if ("error" in r) return r.error;
  if (!rateLimit(`${LIMITS.message.key}:${r.userId}`, LIMITS.message.max, LIMITS.message.windowMs).ok) {
    return mobileError(429, "RATE_LIMITED", "Too many requests. Try again in a minute.");
  }
  const { id } = await params;
  try {
    const app = await getManagedApplication(r.companyId, id.slice(0, 40));
    const conversationId = await ensureConversation({ id: r.userId, isRecruiter: true, recruiterPro: await hasRecruiterPro(r.userId) }, app.applicantId);
    return NextResponse.json({ conversationId }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    const refused = actionErrorResponse(e);
    if (refused) return refused;
    throw e;
  }
}
