import { NextResponse } from "next/server";
import { rateLimit } from "@/server/rate-limit";
import { postReportSchema, reportPost } from "@/server/services/post-reports";
import { actionErrorResponse, getMobileSession, mobileError, parseMobile } from "@/server/mobile/auth";

export const dynamic = "force-dynamic";

// The website's limit for reports: 5 an hour per member.
const REPORTS_PER_HOUR = 5;

// POST /api/mobile/posts/:id/report  { reason, details? }  →  { message }
// "Report post", as on the website: a post you can see and didn't write; admins review it in Admin → Reports.
// Reasons: SPAM, SCAM, HARASSMENT, HATE, INAPPROPRIATE, MISINFORMATION, OTHER.
export async function POST(req: Request, { params }: RouteContext<"/api/mobile/posts/[id]/report">) {
  const session = await getMobileSession(req);
  if (!session) return mobileError(401, "UNAUTHORIZED", "Sign in first.");
  const limit = rateLimit(`report:u:${session.user.id}`, REPORTS_PER_HOUR, 60 * 60_000);
  if (!limit.ok) return mobileError(429, "RATE_LIMITED", `Too many reports. Try again in ${Math.ceil(limit.retryAfterSeconds / 60)} min.`);
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const parsed = parseMobile(postReportSchema, { ...body, postId: id.slice(0, 40) });
  if ("error" in parsed) return parsed.error;
  try {
    await reportPost(session.user.id, parsed.data);
    return NextResponse.json({ message: "Thanks — our team will review this post." }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    const refused = actionErrorResponse(e);
    if (refused) return refused;
    throw e;
  }
}
