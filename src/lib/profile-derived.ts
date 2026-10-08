import { EDUCATION_RANK, type EducationLevel } from "@/lib/constants";

/** Total years of experience with overlapping roles merged (internships count half). */
export function computeYearsExperience(
  experiences: { startDate: Date; endDate: Date | null; isCurrent: boolean; employmentType: string }[],
  now = new Date(),
) {
  const intervals = experiences
    .map((e) => ({
      start: e.startDate.getTime(),
      end: (e.isCurrent || !e.endDate ? now : e.endDate).getTime(),
      factor: e.employmentType === "INTERNSHIP" ? 0.5 : 1,
    }))
    .filter((i) => i.end > i.start)
    .sort((a, b) => a.start - b.start);

  let totalMs = 0;
  let cursor = -Infinity;
  for (const i of intervals) {
    const start = Math.max(i.start, cursor);
    if (i.end > start) {
      totalMs += (i.end - start) * i.factor;
      cursor = i.end;
    }
  }
  return Math.round((totalMs / (365.25 * 24 * 3600 * 1000)) * 10) / 10;
}

export function highestEducation(educations: { level: EducationLevel; endDate: Date | null }[], now = new Date()): EducationLevel {
  let best: EducationLevel = "NONE";
  for (const e of educations) {
    // A degree still in progress doesn't count yet.
    if (e.endDate && e.endDate > now) continue;
    if (EDUCATION_RANK[e.level] > EDUCATION_RANK[best]) best = e.level;
  }
  return best;
}
