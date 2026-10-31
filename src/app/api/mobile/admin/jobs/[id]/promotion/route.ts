import { z } from "zod";
import { JOB_PROMOTIONS, MAX_GRANT_DAYS, setJobPromotionAsAdmin } from "@/server/services/admin-premium";
import { mobileError } from "@/server/mobile/auth";
import { adminChange } from "@/server/mobile/admin";

export const dynamic = "force-dynamic";

const body = z.object({ kind: z.enum(JOB_PROMOTIONS), days: z.number().int().min(0).max(MAX_GRANT_DAYS) });

// POST /api/mobile/admin/jobs/:id/promotion  { kind: "FEATURED"|"URGENT"|"SPONSORED", days }  →  { message }
// Turns the promotion on for that many days (added to what's left), or off with days: 0. No payment.
export async function POST(req: Request, { params }: RouteContext<"/api/mobile/admin/jobs/[id]/promotion">) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return mobileError(400, "INVALID_BODY", `Choose Featured, Urgent or Sponsored, and days (0 to turn off, up to ${MAX_GRANT_DAYS}).`);
  const { id } = await params;
  return adminChange(req, (adminId) => setJobPromotionAsAdmin(adminId, id.slice(0, 64), parsed.data.kind, parsed.data.days));
}
