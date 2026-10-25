import { z } from "zod";
import { setJobStatusForCompany } from "@/server/services/job-editing";
import { mobileError } from "@/server/mobile/auth";
import { recruiterChange } from "@/server/mobile/recruiter";

export const dynamic = "force-dynamic";

const body = z.object({ status: z.enum(["OPEN", "PAUSED", "CLOSED"]) });

// POST /api/mobile/recruiter/jobs/:id/status  { status: "OPEN" | "PAUSED" | "CLOSED" }  →  { status, message }
// Opens (publishes), pauses or closes a job of your company. Reopening checks the closing date.
export async function POST(req: Request, { params }: RouteContext<"/api/mobile/recruiter/jobs/[id]/status">) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return mobileError(400, "INVALID_BODY", "Choose OPEN, PAUSED or CLOSED.");
  const { id } = await params;
  return recruiterChange(req, (r) => setJobStatusForCompany(r, id.slice(0, 40), parsed.data.status), { status: parsed.data.status });
}
