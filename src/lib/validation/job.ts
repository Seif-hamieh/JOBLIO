import { z } from "zod";
import {
  EDUCATION_LEVELS,
  EMPLOYMENT_TYPES,
  EXPERIENCE_LEVELS,
  LANGUAGE_PROFICIENCIES,
  SALARY_PERIODS,
  SKILL_LEVELS,
  WORK_MODES,
} from "@/lib/constants";

const lines = (max: number) =>
  z
    .array(z.string().trim().min(2).max(300))
    .max(max)
    .default([]);

export const jobSchema = z
  .object({
    title: z.string().trim().min(3, "@v.jobTitle").max(120),
    summary: z
      .string()
      .trim()
      .max(280)
      .optional()
      .nullable()
      .transform((v) => v || null),
    description: z.string().trim().min(50, "@v.description").max(10000),
    responsibilities: lines(15),
    requirements: lines(15),
    benefits: lines(15),
    workMode: z.enum(WORK_MODES),
    employmentType: z.enum(EMPLOYMENT_TYPES),
    experienceLevel: z.enum(EXPERIENCE_LEVELS),
    minYearsExperience: z.coerce.number().int().min(0).max(40),
    educationLevel: z.enum(EDUCATION_LEVELS),
    city: z
      .string()
      .trim()
      .max(60)
      .optional()
      .nullable()
      .transform((v) => v || null),
    countryCode: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{2}$/)
      .optional()
      .nullable()
      .or(z.literal("").transform(() => null)),
    salaryMin: z.coerce.number().int().min(0).max(100_000_000).nullable().optional(),
    salaryMax: z.coerce.number().int().min(0).max(100_000_000).nullable().optional(),
    salaryCurrency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/),
    salaryPeriod: z.enum(SALARY_PERIODS),
    industryId: z
      .string()
      .max(40)
      .optional()
      .nullable()
      .transform((v) => v || null),
    closesAt: z
      .union([z.literal(""), z.null(), z.undefined(), z.coerce.date()])
      .transform((v) => (v instanceof Date ? v : null)),
    skills: z
      .array(z.object({ skillId: z.string().min(1).max(40), required: z.boolean(), minLevel: z.enum(SKILL_LEVELS) }))
      .min(1, "@v.skills")
      .max(20),
    languages: z.array(z.object({ languageCode: z.string().regex(/^[a-z]{2,3}$/), minProficiency: z.enum(LANGUAGE_PROFICIENCIES) })).max(6),
    publish: z.boolean().default(true),
  })
  .refine((v) => v.salaryMin == null || v.salaryMax == null || v.salaryMax >= v.salaryMin, { message: "@v.salaryRange", path: ["salaryMax"] })
  .refine((v) => v.workMode === "REMOTE" || !!v.city || !!v.countryCode, { message: "@v.location", path: ["city"] });

export type JobInput = z.input<typeof jobSchema>;
