import { z } from "zod";
import { deleteCompanyAsAdmin, setCompanyVerifiedAsAdmin } from "@/server/services/admin";
import { mobileError } from "@/server/mobile/auth";
import { adminChange } from "@/server/mobile/admin";

export const dynamic = "force-dynamic";

const body = z.object({ verified: z.boolean() });

// POST /api/mobile/admin/companies/:id  { verified }  →  { message }
// Gives or removes the verified badge.
export async function POST(req: Request, { params }: RouteContext<"/api/mobile/admin/companies/[id]">) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return mobileError(400, "INVALID_BODY", "Say whether the company is verified.");
  const { id } = await params;
  return adminChange(req, () => setCompanyVerifiedAsAdmin(id.slice(0, 64), parsed.data.verified));
}

// DELETE /api/mobile/admin/companies/:id  →  { message }
// Permanent: the company's jobs (with their applications), members, posts and media are deleted with it.
export async function DELETE(req: Request, { params }: RouteContext<"/api/mobile/admin/companies/[id]">) {
  const { id } = await params;
  return adminChange(req, () => deleteCompanyAsAdmin(id.slice(0, 64)));
}
