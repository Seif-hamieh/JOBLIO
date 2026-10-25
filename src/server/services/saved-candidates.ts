import "server-only";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { ActionError } from "@/server/action";

// A recruiter's saved candidates ("talent list"), shared by the website and the mobile API. Free recruiters keep
// up to 10; Recruiter Pro is unlimited. Asking for the state you're already in changes nothing.

export const FREE_SAVED_CANDIDATES = 10;

export async function setCandidateSaved(recruiter: { id: string; pro: boolean }, candidateId: string, save: boolean, note: string | null = null) {
  const key = { recruiterId_candidateId: { recruiterId: recruiter.id, candidateId } };
  const existing = await db.savedCandidate.findUnique({ where: key });
  if (save && existing) {
    // Saving again just updates the note.
    if (note !== null) await db.savedCandidate.update({ where: key, data: { note } });
    return "@msg.candidateSaved";
  }
  if (!save && !existing) return "@msg.candidateUnsaved";
  if (existing) await db.savedCandidate.delete({ where: key });
  else {
    if (!recruiter.pro && (await db.savedCandidate.count({ where: { recruiterId: recruiter.id } })) >= FREE_SAVED_CANDIDATES) throw new ActionError("@msg.savedLimit");
    const candidate = await db.user.findUnique({ where: { id: candidateId }, select: { id: true } });
    if (!candidate) throw new ActionError("@msg.memberNotFound");
    await db.savedCandidate.create({ data: { recruiterId: recruiter.id, candidateId, note } });
  }
  revalidatePath("/recruiter/saved");
  return save ? "@msg.candidateSaved" : "@msg.candidateUnsaved";
}
