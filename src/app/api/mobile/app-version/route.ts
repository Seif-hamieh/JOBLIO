import { NextResponse } from "next/server";
import { APP_URL } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** The Android app's newest version, when the setting isn't there. */
const DEFAULT_LATEST = "1.3.1";

// GET /api/mobile/app-version  →  { latestVersion, downloadUrl }
// The app asks on launch; when it's older than latestVersion it offers the download. After putting a new APK in
// public/app, set MOBILE_APP_LATEST_VERSION in .env.production.local to its version and restart the site
// (pm2 restart joblio) — no rebuild needed. No sign-in required.
export function GET() {
  const configured = process.env.MOBILE_APP_LATEST_VERSION?.trim();
  const latestVersion = configured && /^\d+\.\d+\.\d+$/.test(configured) ? configured : DEFAULT_LATEST;
  return NextResponse.json(
    { latestVersion, downloadUrl: new URL("/app/getjoblio.apk", APP_URL).toString() },
    { headers: { "Cache-Control": "public, max-age=300" } },
  );
}
