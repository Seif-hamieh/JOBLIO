import { NextResponse } from "next/server";
import { LIMITS, rateLimit } from "@/server/rate-limit";
import { saveCertificate, saveEducation, saveExperience, saveProject } from "@/server/services/profile-editing";
import { actionErrorResponse, getMobileOwner, mobileError, parseMobile } from "@/server/mobile/auth";
import { certificateSchema, educationSchema, experienceSchema, projectSchema } from "@/lib/validation/profile";

export const dynamic = "force-dynamic";

// POST /api/mobile/me/items/:kind  (kind = experience | education | certificate | project)  →  { ok: true }
// Adds an entry, or updates one when the body has its id. The body is the website form's fields (dates as
// YYYY-MM-DD), checked with the same rules and limits (40 roles, 20 schools, 30 certificates, 30 projects).
export async function POST(req: Request, { params }: RouteContext<"/api/mobile/me/items/[kind]">) {
  const r = await getMobileOwner(req);
  if ("error" in r) return r.error;
  if (!rateLimit(`${LIMITS.write.key}:${r.owner.id}`, LIMITS.write.max, LIMITS.write.windowMs).ok) return mobileError(429, "RATE_LIMITED", "Slow down a little.");
  const { kind } = await params;
  const body = await req.json().catch(() => null);
  try {
    if (kind === "experience") {
      const p = parseMobile(experienceSchema, body);
      if ("error" in p) return p.error;
      await saveExperience(r.owner, p.data);
    } else if (kind === "education") {
      const p = parseMobile(educationSchema, body);
      if ("error" in p) return p.error;
      await saveEducation(r.owner, p.data);
    } else if (kind === "certificate") {
      const p = parseMobile(certificateSchema, body);
      if ("error" in p) return p.error;
      await saveCertificate(r.owner, p.data);
    } else if (kind === "project") {
      const p = parseMobile(projectSchema, body);
      if ("error" in p) return p.error;
      await saveProject(r.owner, p.data);
    } else {
      return mobileError(404, "NOT_FOUND", "Unknown section.");
    }
  } catch (e) {
    const refused = actionErrorResponse(e);
    if (refused) return refused;
    throw e;
  }
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
