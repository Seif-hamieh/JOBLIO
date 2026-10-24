import { z } from "zod";
import { resolveJobReportsAsAdmin } from "@/server/services/admin";
import { mobileError } from "@/server/mobile/auth";
import { adminChange } from "@/server/mobile/admin";

export const dynamic = "force-dynamic";

const body = z.object({ closeJob: z.boolean() });

// POST /api/mobile/admin/reports/:jobId  { closeJob }  →  { message }
// Settles every open report on the job: closes the job too (the reports were right), or just dismisses them.
export async function POST(req: Request, { params }: RouteContext<"/api/mobile/admin/reports/[jobId]">) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return mobileError(400, "INVALID_BODY", "Say whether to close the job.");
  const { jobId } = await params;
  return adminChange(req, () => resolveJobReportsAsAdmin(jobId.slice(0, 64), parsed.data.closeJob));
}
