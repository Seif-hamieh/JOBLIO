import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { syncAllSources } from "@/server/job-import/import";
import { runJobAlerts } from "@/server/services/job-alerts";

export const dynamic = "force-dynamic";
// Three feeds plus up to 300 inserts; well under a minute in practice.
export const maxDuration = 60;

/** Constant-time comparison, so the secret can't be guessed from response timing. */
function sameSecret(given: string | null, expected: string) {
  if (!given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

// GET /api/cron/sync-jobs — imports new listings from Arbeitnow, Jobicy and Himalayas as DRAFT jobs.
// Called by Vercel Cron, which sends "Authorization: Bearer <CRON_SECRET>". Anyone else gets 401.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET is not set" }, { status: 500 });
  if (!sameSecret(req.headers.get("authorization"), `Bearer ${secret}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Imported jobs are posted under this account (the site admin) — set in the environment, never in code.
  const email = process.env.IMPORT_USER_EMAIL?.trim();
  if (!email) return NextResponse.json({ error: "IMPORT_USER_EMAIL is not set" }, { status: 500 });
  const poster = await db.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true } });
  if (!poster) return NextResponse.json({ error: "IMPORT_USER_EMAIL does not match any account" }, { status: 500 });

  const started = Date.now();
  const results = await syncAllSources(poster.id);
  const created = results.reduce((n, r) => n + r.created, 0);
  console.log(`[job-import] ${created} new draft jobs in ${Date.now() - started} ms`, JSON.stringify(results));
  // Then job alerts: every job published since each alert's last check (by anyone), once a day. A failure here never
  // fails the import.
  const alerts = await runJobAlerts().catch((e) => {
    console.error("[job-alerts] run failed:", e);
    return null;
  });
  if (alerts) console.log(`[job-alerts] ${alerts.notified} of ${alerts.checked} alerts had new jobs`);
  return NextResponse.json({ ok: true, created, results, alerts, ms: Date.now() - started });
}
