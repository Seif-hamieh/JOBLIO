import { NextResponse } from "next/server";
import { APP_URL } from "@/lib/utils";
import { resumePdfLink } from "@/server/services/resume-builder";
import { getMobileSession, mobileError } from "@/server/mobile/auth";

export const dynamic = "force-dynamic";

// POST /api/mobile/resume-builder/pdf-link?lang=en|ar  →  { url }
// A 10-minute link to your CV as a PDF, for the phone's browser (which can't send the app's sign-in).
export async function POST(req: Request) {
  const session = await getMobileSession(req);
  if (!session) return mobileError(401, "UNAUTHORIZED", "Sign in first.");
  const lang = new URL(req.url).searchParams.get("lang") === "ar" ? "ar" : "en";
  return NextResponse.json({ url: resumePdfLink(APP_URL, session.user.id, lang) }, { headers: { "Cache-Control": "no-store" } });
}
