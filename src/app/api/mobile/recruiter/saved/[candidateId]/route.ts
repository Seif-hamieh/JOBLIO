import { z } from "zod";
import { setCandidateSaved } from "@/server/services/saved-candidates";
import { recruiterChange } from "@/server/mobile/recruiter";
import { hasRecruiterPro } from "@/server/mobile/messages";

export const dynamic = "force-dynamic";

const body = z.object({ note: z.string().trim().max(500).optional().nullable() }).catch({});

// PUT /api/mobile/recruiter/saved/:candidateId  { note? }  →  { saved: true, message }
// DELETE /api/mobile/recruiter/saved/:candidateId           →  { saved: false, message }
// Saves a candidate for later (free: 10; Recruiter Pro: unlimited), or removes them. Saving again updates the note.
export async function PUT(req: Request, { params }: RouteContext<"/api/mobile/recruiter/saved/[candidateId]">) {
  const { candidateId } = await params;
  const { note } = body.parse(await req.json().catch(() => ({})));
  return recruiterChange(req, async (r) => setCandidateSaved({ id: r.userId, pro: await hasRecruiterPro(r.userId) }, candidateId.slice(0, 40), true, note || null), { saved: true });
}

export async function DELETE(req: Request, { params }: RouteContext<"/api/mobile/recruiter/saved/[candidateId]">) {
  const { candidateId } = await params;
  return recruiterChange(req, async (r) => setCandidateSaved({ id: r.userId, pro: await hasRecruiterPro(r.userId) }, candidateId.slice(0, 40), false), { saved: false });
}
