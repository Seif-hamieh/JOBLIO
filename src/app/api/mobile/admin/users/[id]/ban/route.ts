import { z } from "zod";
import { banUserAsAdmin, unbanUserAsAdmin } from "@/server/services/admin";
import { mobileError } from "@/server/mobile/auth";
import { adminChange } from "@/server/mobile/admin";

export const dynamic = "force-dynamic";

const body = z.object({ banned: z.boolean(), reason: z.string().trim().max(300).optional().nullable() });

// POST /api/mobile/admin/users/:id/ban  { banned, reason? }  →  { message }
// Bans a member (signed out everywhere at once, can't sign in again) or lifts the ban. Admins have to lose their
// role first, and nobody can ban themselves — the same rules as the website.
export async function POST(req: Request, { params }: RouteContext<"/api/mobile/admin/users/[id]/ban">) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return mobileError(400, "INVALID_BODY", "Say whether to ban (reason up to 300 characters).");
  const { id } = await params;
  const userId = id.slice(0, 64);
  return adminChange(req, (adminId) => (parsed.data.banned ? banUserAsAdmin(adminId, userId, parsed.data.reason || null) : unbanUserAsAdmin(userId)));
}
