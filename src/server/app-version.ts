import "server-only";
import { stat } from "node:fs/promises";
import { join } from "node:path";

/** The Android app's newest version, when MOBILE_APP_LATEST_VERSION isn't set. */
const DEFAULT_LATEST = "1.3.1";

/** Where the APK is served from (public/app; not in Git: the file is too big for GitHub). */
export const APK_PATH = "/app/getjoblio.apk";

/**
 * The newest Android version, from MOBILE_APP_LATEST_VERSION in .env.production.local (set after putting a new APK
 * in public/app, then pm2 restart joblio — no rebuild needed).
 */
export function latestAppVersion() {
  const configured = process.env.MOBILE_APP_LATEST_VERSION?.trim();
  return configured && /^\d+\.\d+\.\d+$/.test(configured) ? configured : DEFAULT_LATEST;
}

/** The APK's size in MB (one decimal), or null when the file isn't there. */
export async function apkSizeMb() {
  const s = await stat(join(process.cwd(), "public", APK_PATH)).catch(() => null);
  return s?.isFile() ? Math.round((s.size / 1e6) * 10) / 10 : null;
}
