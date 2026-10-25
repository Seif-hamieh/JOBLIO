"use server";

import { z } from "zod";
import { parse, withRecruiter, withViewer, type ActionState } from "@/server/action";
import { LIMITS } from "@/server/rate-limit";
import { respondToInterview, scheduleInterview, scheduleSchema, setInterviewStatus } from "@/server/services/interviews";

// The rules live in services/interviews (shared with the mobile app); these actions validate and report.

export async function scheduleInterviewAction(input: z.input<typeof scheduleSchema>): Promise<ActionState> {
  return withRecruiter({ limit: LIMITS.write }, async (viewer) => {
    const parsed = parse(scheduleSchema, input);
    if (!parsed.success) return parsed.state;
    return { ok: true, message: await scheduleInterview({ id: viewer.id, companyId: viewer.company.id }, parsed.data) };
  });
}

export async function respondToInterviewAction(interviewId: string, response: "ACCEPTED" | "DECLINED"): Promise<ActionState> {
  return withViewer({ limit: LIMITS.write }, async (viewer) => {
    const message = await respondToInterview(viewer, z.string().max(40).parse(interviewId), z.enum(["ACCEPTED", "DECLINED"]).parse(response));
    return { ok: true, message };
  });
}

export async function updateInterviewStatusAction(interviewId: string, status: "COMPLETED" | "CANCELLED"): Promise<ActionState> {
  return withRecruiter({ limit: LIMITS.write }, async (viewer) => {
    await setInterviewStatus({ id: viewer.id, companyId: viewer.company.id }, z.string().max(40).parse(interviewId), z.enum(["COMPLETED", "CANCELLED"]).parse(status));
    return { ok: true };
  });
}
