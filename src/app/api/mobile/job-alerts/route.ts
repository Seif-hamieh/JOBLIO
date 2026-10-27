import { NextResponse } from "next/server";
import { z } from "zod";
import { LIMITS, rateLimit } from "@/server/rate-limit";
import { createJobAlert, listJobAlerts, MAX_SAVED_SEARCHES } from "@/server/services/job-alerts";
import { getMobileSession, mobileError } from "@/server/mobile/auth";

export const dynamic = "force-dynamic";

const body = z.object({
  name: z.string().trim().min(2).max(80),
  // The jobs search's own fields (q, location, mode…), as the website saves them.
  params: z.record(z.string().max(40), z.union([z.string().max(200), z.number(), z.array(z.string().max(60)).max(20)])),
  alertsEnabled: z.boolean().default(true),
});

// GET /api/mobile/job-alerts  →  { alerts: [{ id, name, params, alertsEnabled, lastAlertedAt, createdAt }] }
// Your saved job searches (the same list as the website's Saved jobs / Settings → Job alerts).
export async function GET(req: Request) {
  const session = await getMobileSession(req);
  if (!session) return mobileError(401, "UNAUTHORIZED", "Sign in first.");
  return NextResponse.json({ alerts: await listJobAlerts(session.user.id) }, { headers: { "Cache-Control": "private, no-store" } });
}

// POST /api/mobile/job-alerts  { name, params: { q, location… }, alertsEnabled? }  →  201 { alert }
// Saves a job search with a daily alert: new jobs that match are announced once a day (Alerts tab and push).
export async function POST(req: Request) {
  const session = await getMobileSession(req);
  if (!session) return mobileError(401, "UNAUTHORIZED", "Sign in first.");
  if (!rateLimit(`${LIMITS.write.key}:${session.user.id}`, LIMITS.write.max, LIMITS.write.windowMs).ok) return mobileError(429, "RATE_LIMITED", "Slow down a little.");
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return mobileError(400, "INVALID_FIELDS", "Give the alert a name (2–80 characters) and a search.");
  const alert = await createJobAlert(session.user.id, parsed.data);
  if (!alert) return mobileError(409, "TOO_MANY", `You can keep up to ${MAX_SAVED_SEARCHES} saved searches. Delete one to add another.`);
  return NextResponse.json({ alert }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
