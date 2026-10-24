import { z } from "zod";
import { closeJobAsAdmin, deleteJobAsAdmin, publishJobAsAdmin } from "@/server/services/admin";
import { mobileError } from "@/server/mobile/auth";
import { adminChange } from "@/server/mobile/admin";

export const dynamic = "force-dynamic";

const body = z.object({ action: z.enum(["close", "publish"]) });

// POST /api/mobile/admin/jobs/:id  { action: "close" | "publish" }  →  { message }
// Closes a job, or publishes a draft (e.g. an imported job after review).
export async function POST(req: Request, { params }: RouteContext<"/api/mobile/admin/jobs/[id]">) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return mobileError(400, "INVALID_BODY", "Choose close or publish.");
  const { id } = await params;
  const jobId = id.slice(0, 64);
  return adminChange(req, () => (parsed.data.action === "close" ? closeJobAsAdmin(jobId) : publishJobAsAdmin(jobId)));
}

// DELETE /api/mobile/admin/jobs/:id  →  { message }
// Permanent: the job's applications, saves and stats are deleted with it.
export async function DELETE(req: Request, { params }: RouteContext<"/api/mobile/admin/jobs/[id]">) {
  const { id } = await params;
  return adminChange(req, () => deleteJobAsAdmin(id.slice(0, 64)));
}
