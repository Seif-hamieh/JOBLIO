import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { privateFileLink } from "@/server/storage";
import { getMobileRecruiter, mobileError } from "@/server/mobile/auth";

export const dynamic = "force-dynamic";

// GET /api/mobile/recruiter/applications/:id/resume  →  { url, expiresIn }
// The CV attached to an application, for the hiring company only: a signed link valid for 5 minutes (Supabase's,
// or our own for files stored on this server). Same access rule as the website's file route for applications.
export async function GET(req: Request, { params }: RouteContext<"/api/mobile/recruiter/applications/[id]/resume">) {
  const r = await getMobileRecruiter(req);
  if ("error" in r) return r.error;
  const { id } = await params;
  const app = await db.application.findFirst({ where: { id: id.slice(0, 40), job: { companyId: r.companyId } }, select: { resumeUrl: true } });
  if (!app?.resumeUrl) return mobileError(404, "NO_RESUME", "No CV is attached to this application.");
  const url = await privateFileLink(app.resumeUrl.replace(/^\/api\/v1\/files\//, ""));
  if (!url) return mobileError(404, "NO_RESUME", "The CV file could not be found.");
  return NextResponse.json({ url, expiresIn: 300 }, { headers: { "Cache-Control": "private, no-store" } });
}
