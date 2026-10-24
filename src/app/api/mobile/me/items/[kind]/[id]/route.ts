import { NextResponse } from "next/server";
import { LIMITS, rateLimit } from "@/server/rate-limit";
import { deleteCertificate, deleteEducation, deleteExperience, deleteProject } from "@/server/services/profile-editing";
import { getMobileOwner, mobileError } from "@/server/mobile/auth";

export const dynamic = "force-dynamic";

const REMOVE = { experience: deleteExperience, education: deleteEducation, certificate: deleteCertificate, project: deleteProject } as const;

// DELETE /api/mobile/me/items/:kind/:id  →  { ok: true }
// Removes one of your entries (only ever your own; an unknown id changes nothing).
export async function DELETE(req: Request, { params }: RouteContext<"/api/mobile/me/items/[kind]/[id]">) {
  const r = await getMobileOwner(req);
  if ("error" in r) return r.error;
  if (!rateLimit(`${LIMITS.write.key}:${r.owner.id}`, LIMITS.write.max, LIMITS.write.windowMs).ok) return mobileError(429, "RATE_LIMITED", "Slow down a little.");
  const { kind, id } = await params;
  if (!(kind in REMOVE)) return mobileError(404, "NOT_FOUND", "Unknown section.");
  await REMOVE[kind as keyof typeof REMOVE](r.owner, id.slice(0, 40));
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
