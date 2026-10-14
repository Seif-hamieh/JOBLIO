import "server-only";
import { db } from "@/server/db";
import { ActionError } from "@/server/action";
import { startOfTodayUtc } from "@/lib/validation/job";
import { k } from "@/i18n/message";
import { notify } from "@/server/services/notifications";
import { checkAchievements } from "@/server/services/achievements";
import { candidateMatchSelect, jobMatchSelect, toCandidateFacts, toJobFacts } from "@/server/services/matching";
import { computeMatch } from "@/lib/matching/engine";
import { STATUS_FOR_STAGE, type ApplicationStatus, type PipelineStage } from "@/lib/constants";
export { STATUS_FOR_STAGE };

/** Candidate-facing status implied by moving a card to a pipeline stage. */

// companyId is stored with the name so the notification shows the company's current name after a rename.
const CANDIDATE_MESSAGE: Partial<Record<ApplicationStatus, (job: string, company: string, companyId: string) => string>> = {
  VIEWED: (job, company, companyId) => k("notif.appViewed", { job, company, companyId }),
  SHORTLISTED: (job) => k("notif.appShortlisted", { job }),
  INTERVIEW: (job, company, companyId) => k("notif.appInterview", { job, company, companyId }),
  OFFER: (job, company, companyId) => k("notif.appOffer", { job, company, companyId }),
  HIRED: (job, company, companyId) => k("notif.appHired", { job, company, companyId }),
  REJECTED: (job, company, companyId) => k("notif.appRejected", { job, company, companyId }),
};

function dayStart(d = new Date()) {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

export async function applyToJob(userId: string, jobId: string, input: { coverLetter: string | null; resumeUrl: string | null }) {
  const [job, profile, existing] = await Promise.all([
    db.job.findUnique({
      where: { id: jobId },
      select: { ...jobMatchSelect, id: true, title: true, status: true, postedById: true, publishedAt: true, closesAt: true, company: { select: { id: true, name: true, members: { select: { userId: true } } } } },
    }),
    db.profile.findUnique({ where: { userId }, select: candidateMatchSelect }),
    db.application.findUnique({ where: { jobId_applicantId: { jobId, applicantId: userId } }, select: { id: true, status: true } }),
  ]);
  if (!job || job.status !== "OPEN" || (job.closesAt && job.closesAt.getTime() < startOfTodayUtc())) throw new ActionError("@msg.jobClosed");
  if (job.company.members.some((m) => m.userId === userId)) throw new ActionError("@msg.ownCompany");
  if (existing && existing.status !== "WITHDRAWN") throw new ActionError("@msg.alreadyApplied");
  if (!profile) throw new ActionError("@msg.completeProfile");
  if (input.resumeUrl && !input.resumeUrl.startsWith(`/api/v1/files/private/resume/${userId.replace(/[^a-zA-Z0-9_-]/g, "")}/`)) {
    throw new ActionError("@msg.invalidCv");
  }

  // Snapshot the score recruiters will see (their perspective includes availability).
  const match = computeMatch(toCandidateFacts(profile), toJobFacts(job), "recruiter");

  const application = await db.$transaction(async (tx) => {
    const data = {
      status: "APPLIED" as const,
      stage: "APPLIED" as const,
      stagePosition: Date.now(),
      coverLetter: input.coverLetter,
      resumeUrl: input.resumeUrl,
      matchScore: match.score,
      matchSnapshot: JSON.parse(JSON.stringify(match)),
      viewedAt: null,
      rating: null,
      priorityAt: null,
      createdAt: new Date(),
    };
    let app = existing
      ? await tx.application.update({ where: { id: existing.id }, data })
      : await tx.application.create({ data: { ...data, jobId, applicantId: userId } });
    // Priority Application: spend one credit if the member has any (a single conditional
    // UPDATE, so two simultaneous applications can't spend the same credit) and put this
    // application at the top of the recruiter's "Applied" column.
    const spent = await tx.user.updateMany({ where: { id: userId, priorityCredits: { gt: 0 } }, data: { priorityCredits: { decrement: 1 } } });
    if (spent.count) {
      const top = await tx.application.findFirst({ where: { jobId, stage: "APPLIED", id: { not: app.id } }, orderBy: { stagePosition: "asc" }, select: { stagePosition: true } });
      app = await tx.application.update({ where: { id: app.id }, data: { priorityAt: new Date(), stagePosition: Math.min(top?.stagePosition ?? data.stagePosition, data.stagePosition) - 1024 } });
    }
    await tx.applicationEvent.create({ data: { applicationId: app.id, actorId: userId, toStatus: "APPLIED", toStage: "APPLIED" } });
    await tx.job.update({ where: { id: jobId }, data: { applicationCount: { increment: existing ? 0 : 1 } } });
    await tx.jobDailyStat.upsert({
      where: { jobId_date: { jobId, date: dayStart() } },
      create: { jobId, date: dayStart(), applications: 1 },
      update: { applications: { increment: 1 } },
    });
    return app;
  });

  const applicant = await db.user.findUnique({ where: { id: userId }, select: { name: true } });
  await notify({
    userId: job.postedById,
    actorId: userId,
    type: "NEW_APPLICANT",
    title: k("notif.newApplicant", { name: applicant?.name ?? "—", job: job.title }),
    body: k("notif.newApplicantBody", { score: match.score }),
    href: `/recruiter/jobs/${jobId}/pipeline?a=${application.id}`,
  });
  await checkAchievements(userId, ["FAST_APPLICANT"]);
  return { application, match };
}

export async function withdrawApplication(userId: string, applicationId: string) {
  const app = await db.application.findUnique({ where: { id: applicationId }, select: { applicantId: true, status: true, stage: true } });
  if (!app || app.applicantId !== userId) throw new ActionError("@msg.appNotFound");
  if (["HIRED", "REJECTED", "WITHDRAWN"].includes(app.status)) throw new ActionError("@msg.cantWithdraw");
  await db.$transaction([
    db.application.update({ where: { id: applicationId }, data: { status: "WITHDRAWN" } }),
    db.applicationEvent.create({ data: { applicationId, actorId: userId, fromStatus: app.status, toStatus: "WITHDRAWN", fromStage: app.stage, toStage: app.stage } }),
  ]);
}

/** Loads an application only if the actor belongs to the hiring company. */
export async function getManagedApplication(actorCompanyId: string, applicationId: string) {
  const app = await db.application.findUnique({
    where: { id: applicationId },
    select: {
      id: true,
      status: true,
      stage: true,
      applicantId: true,
      viewedAt: true,
      job: { select: { id: true, title: true, companyId: true, company: { select: { name: true } } } },
    },
  });
  if (!app || app.job.companyId !== actorCompanyId) throw new ActionError("@msg.appNotFound");
  return app;
}

/**
 * Recruiter-side transition. Moving stage implies a candidate-facing status;
 * an explicit status (OFFER, REJECTED) can be set on its own. Every change is
 * logged and the candidate is notified.
 */
export async function transitionApplication(
  actor: { id: string; companyId: string },
  applicationId: string,
  change: { stage?: PipelineStage; status?: ApplicationStatus; position?: number; note?: string | null; leaveHired?: boolean },
) {
  const app = await getManagedApplication(actor.companyId, applicationId);
  if (app.status === "WITHDRAWN") throw new ActionError("@msg.candidateWithdrew");
  // A hired candidate must be moved out of Hired before they can be declined,
  // so "you're hired" is never followed by "not selected" by accident.
  if (app.status === "HIRED" && change.status === "REJECTED") throw new ActionError("@msg.cannotDeclineHired");
  const stage = change.stage ?? app.stage;
  let status: ApplicationStatus = change.status ?? (change.stage && change.stage !== app.stage ? STATUS_FOR_STAGE[change.stage] : app.status);
  // Moving a rejected candidate back onto the board re-opens them.
  if (!change.status && app.status === "REJECTED" && change.stage) status = STATUS_FOR_STAGE[change.stage];
  // An offer stays an offer while the card sits in Final.
  if (!change.status && app.status === "OFFER" && stage === "FINAL") status = "OFFER";

  // Hired is final: leaving it needs an explicit, confirmed request (it tells the candidate their status changed).
  if (app.status === "HIRED" && status !== "HIRED" && !change.leaveHired) throw new ActionError("@msg.hiredLocked");

  const changed = status !== app.status || stage !== app.stage;
  await db.$transaction(async (tx) => {
    await tx.application.update({
      where: { id: applicationId },
      data: { stage, status, ...(change.position != null && { stagePosition: change.position }), viewedAt: app.viewedAt ?? new Date() },
    });
    if (changed || change.note) {
      await tx.applicationEvent.create({
        data: { applicationId, actorId: actor.id, fromStatus: app.status, toStatus: status, fromStage: app.stage, toStage: stage, note: change.note ?? null },
      });
    }
  });

  if (status !== app.status) {
    const message = CANDIDATE_MESSAGE[status]?.(app.job.title, app.job.company.name, actor.companyId);
    if (message) {
      await notify({
        userId: app.applicantId,
        actorId: actor.id,
        type: "APPLICATION_UPDATE",
        title: message,
        body: status === "REJECTED" ? k("notif.appRejectedBody") : undefined,
        href: "/applications",
      });
    }
    if (["SHORTLISTED", "INTERVIEW", "OFFER", "HIRED"].includes(status)) await checkAchievements(app.applicantId, ["TOP_CANDIDATE"]);
  }
  return { status, stage };
}

/** Marks an application viewed the first time a recruiter opens it. */
export async function markViewed(actor: { id: string; companyId: string }, applicationId: string) {
  const app = await getManagedApplication(actor.companyId, applicationId);
  if (app.viewedAt) return;
  if (app.status === "APPLIED") return transitionApplication(actor, applicationId, { status: "VIEWED" });
  await db.application.update({ where: { id: applicationId }, data: { viewedAt: new Date() } });
}
