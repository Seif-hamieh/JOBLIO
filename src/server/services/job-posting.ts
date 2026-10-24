import "server-only";
import { db } from "@/server/db";
import { publish } from "@/server/realtime";
import type { jobSchema } from "@/lib/validation/job";
import { createT } from "@/i18n/translate";
import { k } from "@/i18n/message";

// Posting a job, shared by the website's job form (createJobAction) and the mobile API.

type ParsedJob = ReturnType<typeof jobSchema.parse>;

export async function notifyFollowersOfNewJob(job: { id: string; title: string; companyId: string }, actorId: string) {
  const company = await db.company.findUniqueOrThrow({ where: { id: job.companyId }, select: { name: true } });
  const followers = await db.companyFollower.findMany({ where: { companyId: job.companyId }, select: { userId: true } });
  if (!followers.length) return;
  const settings = await db.userSettings.findMany({ where: { userId: { in: followers.map((f) => f.userId) }, notifyJobAlerts: false }, select: { userId: true } });
  const optedOut = new Set(settings.map((s) => s.userId));
  const recipients = followers.map((f) => f.userId).filter((u) => !optedOut.has(u) && u !== actorId);
  const vars = { company: company.name, companyId: job.companyId, job: job.title };
  const title = createT("en")("notif.newJob", vars);
  // Bulk insert keeps fan-out cheap even for large follower counts.
  await db.notification.createMany({ data: recipients.map((userId) => ({ userId, actorId, type: "NEW_JOB_FROM_FOLLOWED_COMPANY" as const, title, titleKey: "notif.newJob", vars, href: `/jobs/${job.id}` })) });
  // Encoded so each browser shows it in its own language.
  for (const u of recipients) publish(u, { type: "notification", id: job.id, title: k("notif.newJob", vars), href: `/jobs/${job.id}` });
}

export function jobData(d: ParsedJob) {
  const { skills, languages, publish: _publish, ...rest } = d;
  void _publish;
  return { rest, skills, languages };
}

/** Creates a job for the poster's company: published (and followers told) or saved as a draft. */
export async function createJobForCompany(poster: { userId: string; companyId: string }, data: ParsedJob) {
  const { rest, skills, languages } = jobData(data);
  const validSkills = new Set((await db.skill.findMany({ where: { id: { in: skills.map((s) => s.skillId) } }, select: { id: true } })).map((s) => s.id));
  const job = await db.job.create({
    data: {
      ...rest,
      companyId: poster.companyId,
      postedById: poster.userId,
      status: data.publish ? "OPEN" : "DRAFT",
      publishedAt: data.publish ? new Date() : null,
      skills: { create: skills.filter((s, i, a) => validSkills.has(s.skillId) && a.findIndex((x) => x.skillId === s.skillId) === i) },
      languages: { create: languages.filter((l, i, a) => a.findIndex((x) => x.languageCode === l.languageCode) === i) },
    },
  });
  if (data.publish) await notifyFollowersOfNewJob(job, poster.userId);
  return job;
}
