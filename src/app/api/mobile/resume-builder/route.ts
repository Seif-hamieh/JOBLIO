import { NextResponse } from "next/server";
import { LIMITS, rateLimit } from "@/server/rate-limit";
import { getResume, resetResume, resumeSchema, saveResume } from "@/server/services/resume-builder";
import { getMobileSession, mobileError } from "@/server/mobile/auth";
import { messageText } from "@/server/mobile/drafts";

export const dynamic = "force-dynamic";

const lang = (req: Request) => (new URL(req.url).searchParams.get("lang") === "ar" ? "ar" : "en");

// GET /api/mobile/resume-builder?lang=en|ar  →  { resume, saved, updatedAt }
// Your CV builder data; never saved yet, a first version from your profile (saved: false).
export async function GET(req: Request) {
  const session = await getMobileSession(req);
  if (!session) return mobileError(401, "UNAUTHORIZED", "Sign in first.");
  const { data, saved, updatedAt } = await getResume(session.user.id, lang(req));
  return NextResponse.json({ resume: data, saved, updatedAt: updatedAt?.toISOString() ?? null }, { headers: { "Cache-Control": "no-store" } });
}

// PUT /api/mobile/resume-builder  { fullName, headline, email, phone, location, summary, experience[], education[],
// skills[], languages[], links[] }  →  { updatedAt }   (the whole CV at once, as GET returns it)
export async function PUT(req: Request) {
  const session = await getMobileSession(req);
  if (!session) return mobileError(401, "UNAUTHORIZED", "Sign in first.");
  if (!rateLimit(`${LIMITS.write.key}:${session.user.id}`, LIMITS.write.max, LIMITS.write.windowMs).ok) return mobileError(429, "RATE_LIMITED", "Slow down a little.");
  const parsed = resumeSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const key = parsed.error.issues[0]?.message;
    return mobileError(400, "INVALID_FIELDS", messageText(key?.startsWith("@") ? key : "@v.resumeInvalid"));
  }
  const updatedAt = await saveResume(session.user.id, parsed.data);
  return NextResponse.json({ updatedAt: updatedAt.toISOString() }, { headers: { "Cache-Control": "no-store" } });
}

// DELETE /api/mobile/resume-builder  →  204   (start again from the profile)
export async function DELETE(req: Request) {
  const session = await getMobileSession(req);
  if (!session) return mobileError(401, "UNAUTHORIZED", "Sign in first.");
  await resetResume(session.user.id);
  return new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
