import { NextResponse } from "next/server";
import { APP_URL } from "@/lib/utils";
import { APK_PATH, latestAppVersion } from "@/server/app-version";

export const dynamic = "force-dynamic";

// GET /api/mobile/app-version  →  { latestVersion, downloadUrl }
// The app asks on launch; when it's older than latestVersion it offers the download. After putting a new APK in
// public/app, set MOBILE_APP_LATEST_VERSION in .env.production.local to its version and restart the site
// (pm2 restart joblio) — no rebuild needed. No sign-in required.
export function GET() {
  return NextResponse.json(
    { latestVersion: latestAppVersion(), downloadUrl: new URL(APK_PATH, APP_URL).toString() },
    { headers: { "Cache-Control": "public, max-age=300" } },
  );
}
