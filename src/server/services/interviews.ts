import "server-only";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db";
import { ActionError } from "@/server/action";
import { notify } from "@/server/services/notifications";
import { getManagedApplication, transitionApplication } from "@/server/services/applications";
import { INTERVIEW_TYPES } from "@/lib/constants";
import { k } from "@/i18n/message";

// Interviews, shared by the website and the mobile API: the candidate's answer, and the company scheduling and
// updating them.

/** The candidate accepts or declines an interview invitation; whoever scheduled it is told. Returns the message key. */
export async function respondToInterview(candidate: { id: string; name: string }, interviewId: string, response: "ACCEPTED" | "DECLINED") {
  const interview = await db.interview.findUnique({
    where: { id: interviewId },
    select: { id: true, status: true, scheduledById: true, startsAt: true, application: { select: { applicantId: true, job: { select: { title: true } } } } },
  });
  if (!interview || interview.application.applicantId !== candidate.id) throw new ActionError("@msg.interviewNotFound");
  if (interview.status !== "SCHEDULED") throw new ActionError("@msg.interviewNotScheduled");
  await db.interview.update({ where: { id: interview.id }, data: { candidateResponse: response } });
  await notify({
    userId: interview.scheduledById,
    actorId: candidate.id,
    type: "INTERVIEW_RESPONSE",
    title: k(response === "ACCEPTED" ? "notif.interviewResponseAccepted" : "notif.interviewResponseDeclined", { name: candidate.name, job: interview.application.job.title }),
    href: "/interviews",
  });
  revalidatePath("/interviews");
  return response === "ACCEPTED" ? "@msg.interviewConfirmed" : "@msg.interviewDeclined";
}

// ── The company's side ────────────────────────────────────────────────────

export const scheduleSchema = z
  .object({
    applicationId: z.string().min(1).max(40),
    startsAt: z.coerce.date(),
    durationMinutes: z.coerce.number().int().min(15).max(480),
    type: z.enum(INTERVIEW_TYPES),
    location: z.string().trim().max(200).optional().nullable().transform((v) => v || null),
    meetingUrl: z
      .string()
      .trim()
      .max(300)
      .optional()
      .nullable()
      .transform((v) => v || null)
      .refine((v) => !v || /^https:\/\//.test(v), "@v.meetingLink"),
    notes: z.string().trim().max(1000).optional().nullable().transform((v) => v || null),
  })
  .refine((v) => v.startsAt.getTime() > Date.now() - 60_000, { message: "@v.future", path: ["startsAt"] });

type Recruiter = { id: string; companyId: string };

/**
 * Invites an applicant of the company to an interview. An application still at Applied / Screening moves to the
 * Interview stage, and the candidate is notified. Returns the message key.
 */
export async function scheduleInterview(recruiter: Recruiter, d: z.output<typeof scheduleSchema>) {
  const app = await getManagedApplication(recruiter.companyId, d.applicationId);
  await db.interview.create({
    data: {
      applicationId: d.applicationId,
      scheduledById: recruiter.id,
      startsAt: d.startsAt,
      durationMinutes: d.durationMinutes,
      type: d.type,
      location: d.location,
      meetingUrl: d.meetingUrl,
      notes: d.notes,
    },
  });
  if (app.stage === "APPLIED" || app.stage === "SCREENING") {
    await transitionApplication(recruiter, d.applicationId, { stage: "INTERVIEW" });
  }
  await notify({
    userId: app.applicantId,
    actorId: recruiter.id,
    type: "INTERVIEW_INVITATION",
    title: k("notif.interviewInvite", { company: app.job.company.name, companyId: recruiter.companyId }),
    body: app.job.title,
    href: "/interviews",
  });
  revalidatePath("/interviews");
  revalidatePath(`/recruiter/jobs/${app.job.id}/pipeline`);
  return "@msg.interviewScheduled";
}

/** Marks an interview of the company done, or cancels it (the candidate is told). */
export async function setInterviewStatus(recruiter: Recruiter, interviewId: string, status: "COMPLETED" | "CANCELLED") {
  const interview = await db.interview.findUnique({
    where: { id: interviewId },
    select: { id: true, application: { select: { applicantId: true, job: { select: { title: true, companyId: true, company: { select: { name: true } } } } } } },
  });
  if (!interview || interview.application.job.companyId !== recruiter.companyId) throw new ActionError("@msg.interviewNotFound");
  await db.interview.update({ where: { id: interview.id }, data: { status } });
  if (status === "CANCELLED") {
    await notify({
      userId: interview.application.applicantId,
      actorId: recruiter.id,
      type: "APPLICATION_UPDATE",
      title: k("notif.interviewCancelled", { company: interview.application.job.company.name, job: interview.application.job.title }),
      href: "/interviews",
    });
  }
  revalidatePath("/interviews");
}
