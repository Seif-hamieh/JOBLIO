import { NextResponse } from "next/server";
import { enabledSocialProviders } from "@/server/auth";

export const dynamic = "force-dynamic";

// GET /api/mobile/auth/providers  →  { google: { webClientId } | null }
// Which "Continue with…" buttons the app should show, like the website does. The app asks Google for an ID token
// issued to this web client ID (public, not a secret), which is what /api/mobile/auth/google accepts. Turning Google
// on or off in the server settings shows or hides the button without a new app build.
export function GET() {
  const webClientId = process.env.GOOGLE_CLIENT_ID;
  return NextResponse.json(
    { google: enabledSocialProviders.includes("google") && webClientId ? { webClientId } : null },
    { headers: { "Cache-Control": "no-store" } },
  );
}
