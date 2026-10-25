import { z } from "zod";
import { ActionError } from "@/server/action";
import { LIMITS, rateLimit } from "@/server/rate-limit";
import { setCompanyImage } from "@/server/services/company-editing";
import { UploadError } from "@/server/storage";
import { actionErrorResponse, getMobileRecruiter, mobileError } from "@/server/mobile/auth";
import { canManage } from "@/server/mobile/recruiter";
import { resolveMessage } from "@/i18n/message";
import { createT } from "@/i18n/translate";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const kinds = z.enum(["logo", "cover"]);

// POST /api/mobile/recruiter/company/image  (multipart: kind = logo | cover, file)  →  { url }
// A new logo or cover for your company page (owners and admins only), checked by its real contents; the old file
// is deleted.
export async function POST(req: Request) {
  const r = await getMobileRecruiter(req);
  if ("error" in r) return r.error;
  if (!rateLimit(`${LIMITS.upload.key}:${r.userId}`, LIMITS.upload.max, LIMITS.upload.windowMs).ok) return mobileError(429, "RATE_LIMITED", "Too many uploads. Try again in a few minutes.");
  const form = await req.formData().catch(() => null);
  const kind = kinds.safeParse(form?.get("kind"));
  const file = form?.get("file");
  if (!kind.success || !(file instanceof File)) return mobileError(400, "INVALID_BODY", "Choose an image.");
  try {
    if (!(await canManage(r))) throw new ActionError("@msg.adminsOnlyImages");
    const url = await setCompanyImage(r.companyId, kind.data, file);
    return NextResponse.json({ url }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof UploadError) return mobileError(400, "INVALID_IMAGE", resolveMessage(createT("en"), e.message));
    const refused = actionErrorResponse(e);
    if (refused) return refused;
    throw e;
  }
}
