import { NextResponse } from "next/server";
import { z } from "zod";
import { getPremiumStatus, grantPremiumAsAdmin, MAX_GRANT_CREDITS, MAX_GRANT_DAYS, revokePremiumAsAdmin, USER_FEATURES } from "@/server/services/admin-premium";
import { actionErrorResponse, mobileError } from "@/server/mobile/auth";
import { adminChange, getMobileAdmin, noStore } from "@/server/mobile/admin";

export const dynamic = "force-dynamic";

// GET /api/mobile/admin/users/:id/premium  →  { status }
// The member's premium: each plan (active, until, given by an admin or paid), Profile Boost, Priority credits.
export async function GET(req: Request, { params }: RouteContext<"/api/mobile/admin/users/[id]/premium">) {
  const a = await getMobileAdmin(req);
  if ("error" in a) return a.error;
  const { id } = await params;
  try {
    return NextResponse.json({ status: await getPremiumStatus(id.slice(0, 64)) }, { headers: noStore });
  } catch (e) {
    const refused = actionErrorResponse(e);
    if (refused) return refused;
    throw e;
  }
}

const body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("grant"), feature: z.enum(USER_FEATURES), days: z.number().int().min(1).max(MAX_GRANT_DAYS).optional(), credits: z.number().int().min(1).max(MAX_GRANT_CREDITS).optional() }),
  z.object({ action: z.literal("revoke"), feature: z.enum(USER_FEATURES) }),
]);

// POST /api/mobile/admin/users/:id/premium  { action: "grant", feature, days? | credits? } | { action: "revoke", feature }  →  { message }
// Gives a feature without payment (days for plans and Profile Boost, credits for Priority Application), or ends one
// an admin gave. Same rules as the website.
export async function POST(req: Request, { params }: RouteContext<"/api/mobile/admin/users/[id]/premium">) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return mobileError(400, "INVALID_BODY", `Choose a feature, and days (1–${MAX_GRANT_DAYS}) or credits (1–${MAX_GRANT_CREDITS}).`);
  const { id } = await params;
  const userId = id.slice(0, 64);
  const d = parsed.data;
  return adminChange(req, (adminId) =>
    d.action === "grant" ? grantPremiumAsAdmin(adminId, userId, d.feature, (d.feature === "PRIORITY_APPLICATION" ? d.credits : d.days) ?? 30) : revokePremiumAsAdmin(userId, d.feature),
  );
}
