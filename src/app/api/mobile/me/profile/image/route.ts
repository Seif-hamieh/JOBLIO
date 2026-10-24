import { NextResponse } from "next/server";
import { z } from "zod";
import { LIMITS, rateLimit } from "@/server/rate-limit";
import { removeProfileImage, setProfileImage, storeProjectImage } from "@/server/services/profile-editing";
import { UploadError } from "@/server/storage";
import { getMobileOwner, mobileError } from "@/server/mobile/auth";
import { resolveMessage } from "@/i18n/message";
import { createT } from "@/i18n/translate";

export const dynamic = "force-dynamic";

const kinds = z.enum(["avatar", "cover", "project"]);

// POST /api/mobile/me/profile/image  (multipart: kind = avatar | cover | project, file)  →  { url }
// A new profile photo or cover (saved at once, the old file deleted), or a project image (attached when the
// project is saved). Checked by its real contents, as on the website.
export async function POST(req: Request) {
  const r = await getMobileOwner(req);
  if ("error" in r) return r.error;
  if (!rateLimit(`${LIMITS.upload.key}:${r.owner.id}`, LIMITS.upload.max, LIMITS.upload.windowMs).ok) return mobileError(429, "RATE_LIMITED", "Too many uploads. Try again in a few minutes.");
  const form = await req.formData().catch(() => null);
  const kind = kinds.safeParse(form?.get("kind"));
  const file = form?.get("file");
  if (!kind.success || !(file instanceof File)) return mobileError(400, "INVALID_BODY", "Choose an image.");
  try {
    const url = kind.data === "project" ? await storeProjectImage(r.owner, file) : await setProfileImage(r.owner, kind.data, file);
    return NextResponse.json({ url }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof UploadError) return mobileError(400, "INVALID_IMAGE", resolveMessage(createT("en"), e.message));
    throw e;
  }
}

// DELETE /api/mobile/me/profile/image?kind=avatar|cover  →  { ok: true }
export async function DELETE(req: Request) {
  const r = await getMobileOwner(req);
  if ("error" in r) return r.error;
  if (!rateLimit(`${LIMITS.write.key}:${r.owner.id}`, LIMITS.write.max, LIMITS.write.windowMs).ok) return mobileError(429, "RATE_LIMITED", "Slow down a little.");
  const kind = z.enum(["avatar", "cover"]).safeParse(new URL(req.url).searchParams.get("kind"));
  if (!kind.success) return mobileError(400, "INVALID_BODY", "Say which image to remove.");
  await removeProfileImage(r.owner, kind.data);
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
