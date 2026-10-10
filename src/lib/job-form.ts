import type { EducationLevel, EmploymentType, ExperienceLevel, LanguageProficiency, SalaryPeriod, SkillLevel, WorkMode } from "@/lib/constants";

// Shared by the job form (client) and the new/edit job pages (server). It must
// not live in a "use client" module: values exported from one arrive in server
// components as opaque client references, not data.

export type JobFormValue = {
  title: string;
  summary: string;
  description: string;
  responsibilities: string[];
  requirements: string[];
  benefits: string[];
  workMode: WorkMode;
  employmentType: EmploymentType;
  experienceLevel: ExperienceLevel;
  minYearsExperience: number;
  educationLevel: EducationLevel;
  city: string;
  countryCode: string;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string;
  salaryPeriod: SalaryPeriod;
  industryId: string;
  closesAt: string;
  skills: { skillId: string; name: string; required: boolean; minLevel: SkillLevel }[];
  languages: { languageCode: string; minProficiency: LanguageProficiency }[];
};

export const EMPTY_JOB: JobFormValue = {
  title: "",
  summary: "",
  description: "",
  responsibilities: [],
  requirements: [],
  benefits: [],
  workMode: "HYBRID",
  employmentType: "FULL_TIME",
  experienceLevel: "MID",
  minYearsExperience: 2,
  educationLevel: "NONE",
  city: "",
  countryCode: "",
  salaryMin: null,
  salaryMax: null,
  salaryCurrency: "USD",
  salaryPeriod: "YEAR",
  industryId: "",
  closesAt: "",
  skills: [],
  languages: [],
};
