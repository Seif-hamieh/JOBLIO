import { z } from "zod";
import { setInterviewStatus } from "@/server/services/interviews";
import { mobileError } from "@/server/mobile/auth";
import { recruiterChange } from "@/server/mobile/recruiter";

export const dynamic = "force-dynamic";

const body = z.object({ status: z.enum(["COMPLETED", "CANCELLED"]) });

// POST /api/mobile/recruiter/interviews/:id  { status: "COMPLETED" | "CANCELLED" }  →  { status }
// Marks one of your company's interviews done, or cancels it (the candidate is told). To change the time, cancel it
// and schedule a new one — as on the website.
export async function POST(req: Request, { params }: RouteContext<"/api/mobile/recruiter/interviews/[id]">) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return mobileError(400, "INVALID_BODY", "Choose COMPLETED or CANCELLED.");
  const { id } = await params;
  return recruiterChange(req, (r) => setInterviewStatus({ id: r.userId, companyId: r.companyId }, id.slice(0, 40), parsed.data.status), { status: parsed.data.status });
}
