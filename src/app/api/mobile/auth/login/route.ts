import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/server/auth";
import { mobileError, tokenFromSetCookie } from "@/server/mobile/auth";
import { toMe } from "@/server/mobile/dto";

export const dynamic = "force-dynamic";

const body = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(128),
});

// POST /api/mobile/auth/login  { email, password }  →  { token, user }
// The request goes through Better Auth's own sign-in endpoint (same password check, same rate limits and the same
// "verify your email first" rule as the website); the session it creates is handed back as a bearer token.
export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return mobileError(400, "INVALID_BODY", "Send a JSON body with email and password.");

  const forward = new Headers({ "content-type": "application/json" });
  for (const h of ["x-forwarded-for", "x-real-ip", "user-agent", "accept-language"]) {
    const v = req.headers.get(h);
    if (v) forward.set(h, v); // rate limiting is per client address
  }
  const res = await auth.handler(
    new Request(new URL("/api/auth/sign-in/email", process.env.BETTER_AUTH_URL), {
      method: "POST",
      headers: forward,
      body: JSON.stringify({ email: parsed.data.email, password: parsed.data.password, rememberMe: true }),
    }),
  );

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { code?: string };
    if (res.status === 429) return mobileError(429, "RATE_LIMITED", "Too many attempts. Try again in a minute.");
    if (err.code === "EMAIL_NOT_VERIFIED") return mobileError(403, "EMAIL_NOT_VERIFIED", "Check your inbox to verify your email first.");
    if (err.code === "INVALID_EMAIL_OR_PASSWORD") return mobileError(401, "INVALID_CREDENTIALS", "That email and password combination didn't work.");
    return mobileError(res.status >= 500 ? 502 : res.status, err.code ?? "SIGN_IN_FAILED", "Sign-in failed.");
  }

  const token = await tokenFromSetCookie(res);
  const data = (await res.json()) as { user: Parameters<typeof toMe>[0] };
  if (!token) return mobileError(502, "NO_SESSION", "Sign-in succeeded but no session was created.");
  return NextResponse.json({ token, user: toMe(data.user) }, { headers: { "Cache-Control": "no-store" } });
}
