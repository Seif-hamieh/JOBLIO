import { auth } from "@/server/auth";
import { bearerToken, mobileError, sessionHeaders } from "@/server/mobile/auth";

export const dynamic = "force-dynamic";

// POST /api/mobile/auth/logout  (Authorization: Bearer <token>)  →  204
// Ends the session on the server, so the token stops working everywhere.
export async function POST(req: Request) {
  const token = bearerToken(req);
  if (!token) return mobileError(401, "UNAUTHORIZED", "Sign in first.");
  await auth.api.signOut({ headers: await sessionHeaders(token) }).catch(() => null);
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
