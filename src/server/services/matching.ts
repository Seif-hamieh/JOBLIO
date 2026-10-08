import "server-only";
import { cache } from "react";
import { db } from "@/server/db";
import { computeMatch, type CandidateFacts, type MatchResult, type Perspective } from "@/lib/matching/engine";
import { candidateMatchSelect, toCandidateFacts, toJobFacts, type JobMatchRow } from "@/lib/matching/prisma-facts";

export * from "@/lib/matching/prisma-facts";

/** The signed-in user's matching facts, loaded once per request. */
export const getCandidateFacts = cache(async (userId: string): Promise<CandidateFacts | null> => {
  const p = await db.profile.findUnique({ where: { userId }, select: candidateMatchSelect });
  return p ? toCandidateFacts(p) : null;
});

export function scoreJobs<T extends JobMatchRow & { id: string }>(
  facts: CandidateFacts | null,
  jobs: T[],
  perspective: Perspective = "seeker",
): Map<string, MatchResult> {
  const out = new Map<string, MatchResult>();
  if (!facts) return out;
  for (const j of jobs) out.set(j.id, computeMatch(facts, toJobFacts(j), perspective));
  return out;
}

/** True when the user has given the matcher enough to work with. */
export function hasMatchingSignals(facts: CandidateFacts | null) {
  return !!facts && (facts.skills.length > 0 || facts.preferredWorkModes.length > 0 || !!facts.city);
}
