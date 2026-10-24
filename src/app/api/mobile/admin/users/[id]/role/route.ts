import { z } from "zod";
import { setUserRoleAsAdmin } from "@/server/services/admin";
import { mobileError } from "@/server/mobile/auth";
import { adminChange } from "@/server/mobile/admin";

export const dynamic = "force-dynamic";

const body = z.object({ role: z.enum(["USER", "ADMIN"]) });

// POST /api/mobile/admin/users/:id/role  { role: "ADMIN" | "USER" }  →  { message }
// Makes a member an admin or removes their admin role. You can't change your own role.
export async function POST(req: Request, { params }: RouteContext<"/api/mobile/admin/users/[id]/role">) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return mobileError(400, "INVALID_BODY", "Choose ADMIN or USER.");
  const { id } = await params;
  return adminChange(req, (adminId) => setUserRoleAsAdmin(adminId, id.slice(0, 64), parsed.data.role));
}
