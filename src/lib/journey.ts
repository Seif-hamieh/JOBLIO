import type { JourneyStep } from "@/components/profile/career-journey";

type Dated = { startDate: Date | null; endDate: Date | null };

const year = (d: Date | null) => (d ? new Date(d).getFullYear() : null);
const period = (s: Date | null, e: Date | null, current = false, present = "Present") => {
  const a = year(s);
  const b = current ? present : year(e);
  if (a && b && a !== b) return `${a} – ${b}`;
  return String(a ?? b ?? "");
};

/** Education → Experience → Projects → Now, sorted chronologically. */
export function buildJourney(p: {
  educations: (Dated & { id: string; school: string; degree: string | null; fieldOfStudy: string | null; description?: string | null })[];
  experiences: (Dated & { id: string; title: string; companyName: string; isCurrent: boolean; description: string | null; startDate: Date })[];
  projects: (Dated & { id: string; title: string; summary: string | null; skills?: { name: string }[] })[];
}, present = "Present"): JourneyStep[] {
  const steps: JourneyStep[] = [];
  for (const e of p.educations) {
    steps.push({
      id: `edu-${e.id}`,
      kind: "education",
      title: [e.degree, e.fieldOfStudy].filter(Boolean).join(" ") || e.school,
      org: e.school,
      period: period(e.startDate, e.endDate),
      description: e.description ?? null,
      at: new Date(e.startDate ?? e.endDate ?? 0).getTime(),
    });
  }
  for (const x of p.experiences) {
    steps.push({
      id: `exp-${x.id}`,
      kind: x.isCurrent ? "current" : "experience",
      title: x.title,
      org: x.companyName,
      period: period(x.startDate, x.endDate, x.isCurrent, present),
      description: x.description,
      at: new Date(x.startDate).getTime() + (x.isCurrent ? 1 : 0),
    });
  }
  for (const pr of p.projects) {
    steps.push({
      id: `prj-${pr.id}`,
      kind: "project",
      title: pr.title,
      org: pr.summary,
      period: period(pr.startDate, pr.endDate),
      skills: pr.skills?.map((s) => s.name),
      at: new Date(pr.startDate ?? pr.endDate ?? Date.now()).getTime(),
    });
  }
  return steps.sort((a, b) => a.at - b.at);
}
