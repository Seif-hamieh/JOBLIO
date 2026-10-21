"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db";
import { fail, localizeState, parse, type ActionState } from "@/server/action";
import { rateLimit } from "@/server/rate-limit";
import { getViewer } from "@/server/session";
import { anonymousViewerKey } from "@/server/services/jobs";
import { getI18n } from "@/i18n/server";
import { k } from "@/i18n/message";

const reportSchema = z.object({
  jobId: z.string().min(1).max(40),
  reason: z.enum(["FAKE", "SCAM", "SPAM", "OFFENSIVE", "EXPIRED", "OTHER"]),
  details: z.string().trim().max(1000).optional().transform((v) => v || null),
});

// Anyone can report — signed in or not — so the limit is per member or per (network address + browser).
const REPORTS_PER_HOUR = 5;

/** "Report job" on a public job page. Admins review reports in Admin → Reports. */
export async function reportJobAction(input: { jobId: string; reason: string; details?: string }): Promise<ActionState> {
  const { t } = await getI18n();
  const parsed = parse(reportSchema, input);
  if (!parsed.success) return localizeState(t, parsed.state);
  const { jobId, reason, details } = parsed.data;

  const viewer = await getViewer();
  const reporterKey = viewer ? `u:${viewer.id}` : await anonymousViewerKey();
  const limit = rateLimit(`report:${reporterKey}`, REPORTS_PER_HOUR, 60 * 60_000);
  if (!limit.ok) return localizeState(t, fail(k("msg.tooOften", { s: limit.retryAfterSeconds })));

  const job = await db.job.findUnique({ where: { id: jobId }, select: { status: true } });
  if (!job || job.status !== "OPEN") return localizeState(t, fail(k("msg.jobNotFound")));

  // One open report per person per job: a second click just confirms the first.
  const existing = await db.jobReport.findFirst({ where: { jobId, reporterKey, status: "OPEN" }, select: { id: true } });
  if (!existing) {
    await db.jobReport.create({ data: { jobId, reporterId: viewer?.id ?? null, reporterKey, reason, details } });
    revalidatePath("/admin/reports");
  }
  return localizeState(t, { ok: true, message: k("jobs.reportThanks") });
}
