import { NextResponse } from "next/server";
import { z } from "zod";
import { forwardToAuth, mobileError } from "@/server/mobile/auth";

export const dynamic = "force-dynamic";

const body = z.object({ email: z.string().trim().toLowerCase().email().max(254) });

// POST /api/mobile/auth/forgot-password  { email }  →  { ok: true }
// Emails a password-reset link, exactly like the website's "Forgot password" (Better Auth's own endpoint, valid for
// an hour). The link opens the website's reset page. The answer is the same whether or not the address has an
// account, so it can't be used to find out who is a member.
export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return mobileError(400, "INVALID_FIELDS", "Enter a valid email address.");
  const res = await forwardToAuth(req, "/request-password-reset", { email: parsed.data.email, redirectTo: "/reset-password" });
  if (res.status === 429) return mobileError(429, "RATE_LIMITED", "Too many attempts. Try again in a minute.");
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
