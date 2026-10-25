"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db";
import { fail, parse, withRecruiter, withViewer, type ActionState } from "@/server/action";
import { LIMITS } from "@/server/rate-limit";
import { notify } from "@/server/services/notifications";
import { respondToInterview } from "@/server/services/interviews";
import { getManagedApplication, transitionApplication } from "@/server/services/applications";
import { INTERVIEW_TYPES } from "@/lib/constants";
import { k } from "@/i18n/message";

const scheduleSchema = z
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

export async function scheduleInterviewAction(input: z.input<typeof scheduleSchema>): Promise<ActionState> {
  return withRecruiter({ limit: LIMITS.write }, async (viewer) => {
    const parsed = parse(scheduleSchema, input);
    if (!parsed.success) return parsed.state;
    const d = parsed.data;
    const app = await getManagedApplication(viewer.company.id, d.applicationId);
    await db.interview.create({
      data: {
        applicationId: d.applicationId,
        scheduledById: viewer.id,
        startsAt: d.startsAt,
        durationMinutes: d.durationMinutes,
        type: d.type,
        location: d.location,
        meetingUrl: d.meetingUrl,
        notes: d.notes,
      },
    });
    if (app.stage === "APPLIED" || app.stage === "SCREENING") {
      await transitionApplication({ id: viewer.id, companyId: viewer.company.id }, d.applicationId, { stage: "INTERVIEW" });
    }
    await notify({
      userId: app.applicantId,
      actorId: viewer.id,
      type: "INTERVIEW_INVITATION",
      title: k("notif.interviewInvite", { company: app.job.company.name, companyId: viewer.company.id }),
      body: app.job.title,
      href: "/interviews",
    });
    revalidatePath("/interviews");
    revalidatePath(`/recruiter/jobs/${app.job.id}/pipeline`);
    return { ok: true, message: "@msg.interviewScheduled" };
  });
}

export async function respondToInterviewAction(interviewId: string, response: "ACCEPTED" | "DECLINED"): Promise<ActionState> {
  return withViewer({ limit: LIMITS.write }, async (viewer) => {
    // The rules live in services/interviews (shared with the app).
    const message = await respondToInterview(viewer, z.string().max(40).parse(interviewId), z.enum(["ACCEPTED", "DECLINED"]).parse(response));
    return { ok: true, message };
  });
}

export async function updateInterviewStatusAction(interviewId: string, status: "COMPLETED" | "CANCELLED"): Promise<ActionState> {
  return withRecruiter({ limit: LIMITS.write }, async (viewer) => {
    const interview = await db.interview.findUnique({
      where: { id: z.string().max(40).parse(interviewId) },
      select: { id: true, application: { select: { applicantId: true, job: { select: { title: true, companyId: true, company: { select: { name: true } } } } } } },
    });
    if (!interview || interview.application.job.companyId !== viewer.company.id) return fail("@msg.interviewNotFound");
    await db.interview.update({ where: { id: interview.id }, data: { status: z.enum(["COMPLETED", "CANCELLED"]).parse(status) } });
    if (status === "CANCELLED") {
      await notify({
        userId: interview.application.applicantId,
        actorId: viewer.id,
        type: "APPLICATION_UPDATE",
        title: k("notif.interviewCancelled", { company: interview.application.job.company.name, job: interview.application.job.title }),
        href: "/interviews",
      });
    }
    revalidatePath("/interviews");
    return { ok: true };
  });
}
