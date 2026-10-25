import "server-only";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { ActionError } from "@/server/action";
import { notify } from "@/server/services/notifications";
import { k } from "@/i18n/message";

// Interviews from the candidate's side, shared by the website and the mobile API.

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
