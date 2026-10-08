// Prisma selections that load exactly the facts the matching engine needs,
// and converters into engine inputs. Framework-free so scripts can use them.
import type { Prisma } from "@/generated/prisma/client";
import type { CandidateFacts, JobFacts } from "@/lib/matching/engine";

export const candidateMatchSelect = {
  yearsExperience: true,
  educationLevel: true,
  city: true,
  countryCode: true,
  preferredCities: true,
  openToRelocate: true,
  preferredWorkModes: true,
  preferredEmploymentTypes: true,
  desiredSalaryMin: true,
  salaryCurrency: true,
  salaryPeriod: true,
  availability: true,
  skills: { select: { skillId: true, level: true, skill: { select: { name: true } } } },
  languages: { select: { languageCode: true, proficiency: true } },
  preferredIndustries: { select: { id: true } },
} satisfies Prisma.ProfileSelect;

export type CandidateMatchRow = Prisma.ProfileGetPayload<{ select: typeof candidateMatchSelect }>;

export function toCandidateFacts(p: CandidateMatchRow): CandidateFacts {
  return {
    skills: p.skills.map((s) => ({ skillId: s.skillId, name: s.skill.name, level: s.level })),
    yearsExperience: p.yearsExperience,
    educationLevel: p.educationLevel,
    city: p.city,
    countryCode: p.countryCode,
    preferredCities: p.preferredCities,
    openToRelocate: p.openToRelocate,
    preferredWorkModes: p.preferredWorkModes,
    preferredEmploymentTypes: p.preferredEmploymentTypes,
    desiredSalaryMin: p.desiredSalaryMin,
    salaryCurrency: p.salaryCurrency,
    salaryPeriod: p.salaryPeriod,
    languages: p.languages.map((l) => ({ code: l.languageCode, proficiency: l.proficiency })),
    preferredIndustryIds: p.preferredIndustries.map((i) => i.id),
    availability: p.availability,
  };
}

export const jobMatchSelect = {
  minYearsExperience: true,
  educationLevel: true,
  workMode: true,
  employmentType: true,
  city: true,
  countryCode: true,
  salaryMin: true,
  salaryMax: true,
  salaryCurrency: true,
  salaryPeriod: true,
  industryId: true,
  industry: { select: { name: true, slug: true } },
  skills: {
    select: { skillId: true, required: true, minLevel: true, skill: { select: { name: true, slug: true } } },
    orderBy: [{ required: "desc" }, { skillId: "asc" }],
  },
  languages: { select: { languageCode: true, minProficiency: true } },
} satisfies Prisma.JobSelect;

export type JobMatchRow = Prisma.JobGetPayload<{ select: typeof jobMatchSelect }>;

export function toJobFacts(j: JobMatchRow): JobFacts {
  return {
    skills: j.skills.map((s) => ({ skillId: s.skillId, name: s.skill.name, required: s.required, minLevel: s.minLevel })),
    minYearsExperience: j.minYearsExperience,
    educationLevel: j.educationLevel,
    workMode: j.workMode,
    employmentType: j.employmentType,
    city: j.city,
    countryCode: j.countryCode,
    salaryMin: j.salaryMin,
    salaryMax: j.salaryMax,
    salaryCurrency: j.salaryCurrency,
    salaryPeriod: j.salaryPeriod,
    languages: j.languages.map((l) => ({ code: l.languageCode, minProficiency: l.minProficiency })),
    industryId: j.industryId,
    industryName: j.industry?.name ?? null,
  };
}
