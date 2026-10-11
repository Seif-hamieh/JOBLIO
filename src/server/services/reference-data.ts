import "server-only";
import { db } from "@/server/db";
import { industryRows, skillRows } from "@/lib/reference-data";

// Skills and industries are referenced by id (job skills, company industry,
// profile preferences), so a fallback must be real rows, not a list shown only
// in the UI. When either table is empty — a fresh database that was never
// seeded — the built-in lists are inserted once. Tables that already have rows
// are never touched.

let ready: Promise<void> | null = null;

export function ensureReferenceData(): Promise<void> {
  ready ??= (async () => {
    const [skills, industries] = await Promise.all([db.skill.count(), db.industry.count()]);
    if (industries === 0) {
      const { count } = await db.industry.createMany({ data: industryRows(), skipDuplicates: true });
      console.info(`[reference-data] inserted ${count} industries into an empty table`);
    }
    if (skills === 0) {
      const { count } = await db.skill.createMany({ data: skillRows(), skipDuplicates: true });
      console.info(`[reference-data] inserted ${count} skills into an empty table`);
    }
  })().catch((e) => {
    // Try again on the next request rather than caching the failure.
    ready = null;
    console.error("[reference-data] could not check or insert reference data:", e);
  });
  return ready;
}
