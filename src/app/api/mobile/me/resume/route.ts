import { NextResponse } from "next/server";
import { LIMITS, rateLimit } from "@/server/rate-limit";
import { getResume, removeResume, saveResume } from "@/server/services/resume";
import { privateFileLink, UploadError } from "@/server/storage";
import { getMobileSession, mobileError } from "@/server/mobile/auth";
import { createT } from "@/i18n/translate";
import { resolveMessage } from "@/i18n/message";

export const dynamic = "force-dynamic";

/** The CV for the app: its name and date, and a link that opens it for 5 minutes. */
async function describe(resume: Awaited<ReturnType<typeof getResume>>) {
  if (!resume) return null;
  return { name: resume.name, updatedAt: resume.updatedAt, url: await privateFileLink(resume.url.replace(/^\/api\/v1\/files\//, "")) };
}

// GET /api/mobile/me/resume  →  { resume: { name, updatedAt, url } | null }
// The CV saved on your profile (one per profile — the one "Attach my profile CV" sends when you apply).
export async function GET(req: Request) {
  const session = await getMobileSession(req);
  if (!session) return mobileError(401, "UNAUTHORIZED", "Sign in first.");
  return NextResponse.json({ resume: await describe(await getResume(session.user.id)) }, { headers: { "Cache-Control": "private, no-store" } });
}

// POST /api/mobile/me/resume  (multipart/form-data: file, name?)  →  { resume }
// Saves a PDF or Word file (checked by its real contents, up to the upload limit) as your CV, replacing the old one.
// `name` is the file's original name, shown back to you and to recruiters.
export async function POST(req: Request) {
  const session = await getMobileSession(req);
  if (!session) return mobileError(401, "UNAUTHORIZED", "Sign in first.");
  if (!rateLimit(`${LIMITS.upload.key}:${session.user.id}`, LIMITS.upload.max, LIMITS.upload.windowMs).ok) {
    return mobileError(429, "RATE_LIMITED", "Too many uploads. Try again in a few minutes.");
  }
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || file.size === 0) return mobileError(400, "FILE_REQUIRED", "Choose a PDF or Word file.");
  const name = form?.get("name");
  try {
    const saved = await saveResume(session.user.id, file, typeof name === "string" ? name : null);
    return NextResponse.json({ resume: await describe(saved) }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof UploadError) return mobileError(400, "INVALID_FILE", resolveMessage(createT("en"), e.message));
    throw e;
  }
}

// DELETE /api/mobile/me/resume  →  204
// Removes your CV. Applications you already sent keep the copy they were sent with.
export async function DELETE(req: Request) {
  const session = await getMobileSession(req);
  if (!session) return mobileError(401, "UNAUTHORIZED", "Sign in first.");
  await removeResume(session.user.id);
  return new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
