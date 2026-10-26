import { NextResponse } from "next/server";
import { z } from "zod";
import { forwardToAuth, mobileError, tokenFromSetCookie } from "@/server/mobile/auth";
import { memberCompany, toMe } from "@/server/mobile/dto";

export const dynamic = "force-dynamic";

const body = z.object({ idToken: z.string().min(20).max(8192) });

/**
 * Why Google's ID token was refused, for the server log: who it was issued for and how its times compare with this
 * server's clock. Never the email, name or account id. Read from the token without trusting it.
 */
function describeRejectedToken(idToken: string) {
  try {
    const claims = JSON.parse(Buffer.from(idToken.split(".")[1] ?? "", "base64url").toString("utf8")) as Record<string, unknown>;
    const now = Math.floor(Date.now() / 1000);
    const at = (v: unknown) => (typeof v === "number" ? v - now : null);
    return {
      iss: claims.iss,
      audIsOurWebClient: claims.aud === process.env.GOOGLE_CLIENT_ID,
      azpIsOurWebClient: claims.azp === process.env.GOOGLE_CLIENT_ID,
      issuedSecondsFromNow: at(claims.iat),
      notBeforeSecondsFromNow: at(claims.nbf),
      expiresSecondsFromNow: at(claims.exp),
    };
  } catch {
    return { unreadable: true };
  }
}

// POST /api/mobile/auth/google  { idToken }  →  { token, user }
// The app signs in with Google on the phone and sends the ID token Google gave it. Better Auth's own social sign-in
// checks it with Google (signature, expiry, and that it was issued for our web client ID), then signs the member in
// exactly like "Continue with Google" on the website: same account linking by email, same ban check, and a new
// member gets an account (Google has already verified the email). The session is handed back as a bearer token.
export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return mobileError(400, "INVALID_BODY", "Send a JSON body with the Google idToken.");

  const signIn = () => forwardToAuth(req, "/sign-in/social", { provider: "google", idToken: { token: parsed.data.idToken }, callbackURL: "/onboarding" });
  let res = await signIn();
  let err = res.ok ? {} : ((await res.clone().json().catch(() => ({}))) as { code?: string });

  // Checking the token means fetching Google's signing keys; a brief hiccup there looks exactly like a bad token.
  // Try once more before telling the member, and log why it was refused so a real cause shows up in the logs.
  if (err.code === "INVALID_TOKEN") {
    console.warn("[mobile/google] ID token refused, retrying once:", describeRejectedToken(parsed.data.idToken));
    res = await signIn();
    err = res.ok ? {} : ((await res.clone().json().catch(() => ({}))) as { code?: string });
  }

  if (!res.ok) {
    if (res.status === 429) return mobileError(429, "RATE_LIMITED", "Too many attempts. Try again in a minute.");
    if (err.code === "PROVIDER_NOT_FOUND") return mobileError(503, "GOOGLE_DISABLED", "Google sign-in isn't available right now.");
    if (err.code === "ACCOUNT_BANNED") return mobileError(403, "ACCOUNT_BANNED", "This account has been suspended. Contact us if you think this is a mistake.");
    if (err.code === "INVALID_TOKEN") return mobileError(401, "INVALID_TOKEN", "Google sign-in couldn't be confirmed. Try again.");
    return mobileError(res.status >= 500 ? 502 : res.status, err.code ?? "SIGN_IN_FAILED", "Google sign-in failed. Try again.");
  }

  const token = await tokenFromSetCookie(res);
  const data = (await res.json()) as { user: Parameters<typeof toMe>[0] };
  if (!token) return mobileError(502, "NO_SESSION", "Sign-in succeeded but no session was created.");
  return NextResponse.json({ token, user: toMe(data.user, await memberCompany(data.user.id)) }, { headers: { "Cache-Control": "no-store" } });
}
