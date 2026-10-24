import { z } from "zod";
import {
  AVAILABILITIES,
  COMPANY_SIZES,
  EDUCATION_LEVELS,
  EMPLOYMENT_TYPES,
  LANGUAGE_PROFICIENCIES,
  MESSAGE_PERMISSIONS,
  PROFILE_VISIBILITIES,
  SALARY_PERIODS,
  SKILL_LEVELS,
  SOCIAL_PLATFORMS,
  USER_INTENTS,
  WORK_MODES,
} from "@/lib/constants";

const text = (max: number) => z.string().trim().max(max);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => v || null);
const url = z
  .string()
  .trim()
  .max(300)
  .refine((v) => {
    try {
      return ["http:", "https:"].includes(new URL(v).protocol);
    } catch {
      return false;
    }
  }, "@v.url");
const optionalUrl = z
  .union([url, z.literal(""), z.null(), z.undefined()])
  .transform((v) => v || null);
const country = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{2}$/, "@v.country")
  .optional()
  .nullable()
  .or(z.literal("").transform(() => null));
const date = z.coerce.date().refine((d) => d.getFullYear() > 1950 && d.getFullYear() < 2100, "@v.date");
const optionalDate = z
  .union([z.literal(""), z.null(), z.undefined(), date])
  .transform((v) => (v instanceof Date ? v : null));
const hexColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "@v.hex")
  .optional()
  .nullable()
  .or(z.literal("").transform(() => null));

export const skillEntrySchema = z.object({ skillId: z.string().min(1).max(40), level: z.enum(SKILL_LEVELS) });

export const preferencesSchema = z.object({
  openToWork: z.boolean(),
  availability: z.enum(AVAILABILITIES),
  desiredTitles: z.array(text(80).min(2)).max(5),
  preferredWorkModes: z.array(z.enum(WORK_MODES)).max(3),
  preferredEmploymentTypes: z.array(z.enum(EMPLOYMENT_TYPES)).max(5),
  preferredCities: z.array(text(60).min(2)).max(5),
  openToRelocate: z.boolean(),
  desiredSalaryMin: z.coerce.number().int().min(0).max(10_000_000).nullable(),
  salaryCurrency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/),
  salaryPeriod: z.enum(SALARY_PERIODS),
  industryIds: z.array(z.string().max(40)).max(5),
});

export const companyCreateSchema = z.object({
  name: text(80).min(2, "@v.companyName"),
  website: optionalUrl,
  industryId: z.string().max(40).optional().nullable(),
  size: z.enum(COMPANY_SIZES),
  city: optionalText(60),
  countryCode: country,
  tagline: optionalText(160),
  title: optionalText(80),
});

export const onboardingSchema = z.object({
  intent: z.enum(USER_INTENTS),
  headline: text(160).min(2, "@v.headline"),
  city: optionalText(60),
  countryCode: country,
  skills: z.array(skillEntrySchema).max(50),
  preferences: preferencesSchema.optional(),
  company: companyCreateSchema.optional(),
});
export type OnboardingInput = z.input<typeof onboardingSchema>;

export const basicsSchema = z.object({
  name: text(80).min(2, "@v.name"),
  headline: optionalText(160),
  about: optionalText(2600),
  pronouns: optionalText(30),
  city: optionalText(60),
  countryCode: country,
  website: optionalUrl,
});

export const experienceSchema = z
  .object({
    id: z.string().max(40).optional(),
    title: text(100).min(2, "@v.title"),
    companyName: text(100).min(1, "@v.company"),
    employmentType: z.enum(EMPLOYMENT_TYPES),
    workMode: z.enum(WORK_MODES).optional().nullable().or(z.literal("").transform(() => null)),
    location: optionalText(80),
    startDate: date,
    endDate: optionalDate,
    isCurrent: z.coerce.boolean(),
    description: optionalText(2000),
  })
  .refine((v) => v.isCurrent || v.endDate, { message: "@v.endDate", path: ["endDate"] })
  .refine((v) => !v.endDate || v.endDate >= v.startDate, { message: "@v.endAfter", path: ["endDate"] });

export const educationSchema = z.object({
  id: z.string().max(40).optional(),
  school: text(120).min(2, "@v.school"),
  degree: optionalText(80),
  fieldOfStudy: optionalText(100),
  level: z.enum(EDUCATION_LEVELS),
  startDate: optionalDate,
  endDate: optionalDate,
  grade: optionalText(40),
  description: optionalText(1000),
});

export const projectSchema = z.object({
  id: z.string().max(40).optional(),
  title: text(100).min(2, "@v.title"),
  summary: optionalText(200),
  description: optionalText(3000),
  url: optionalUrl,
  repoUrl: optionalUrl,
  imageUrl: z.string().max(300).optional().nullable(),
  startDate: optionalDate,
  endDate: optionalDate,
  featured: z.coerce.boolean().optional(),
  skillIds: z.array(z.string().max(40)).max(12).default([]),
});

export const certificateSchema = z.object({
  id: z.string().max(40).optional(),
  name: text(120).min(2, "@v.name"),
  issuer: text(120).min(1, "@v.issuer"),
  issueDate: optionalDate,
  expiryDate: optionalDate,
  credentialId: optionalText(80),
  credentialUrl: optionalUrl,
});

export const languageSchema = z.object({
  languageCode: z.string().regex(/^[a-z]{2,3}$/),
  proficiency: z.enum(LANGUAGE_PROFICIENCIES),
});

export const socialLinkSchema = z.object({ platform: z.enum(SOCIAL_PLATFORMS), url });

export const privacySchema = z.object({
  visibility: z.enum(PROFILE_VISIBILITIES),
  searchableByRecruiters: z.boolean(),
  privateBrowsing: z.boolean(),
  messagePermission: z.enum(MESSAGE_PERMISSIONS),
  showConnections: z.boolean(),
});

export const companyProfileSchema = z.object({
  name: text(80).min(2),
  tagline: optionalText(160),
  about: optionalText(4000),
  website: optionalUrl,
  industryId: z.string().max(40).optional().nullable(),
  size: z.enum(COMPANY_SIZES),
  foundedYear: z.coerce.number().int().min(1800).max(2100).optional().nullable(),
  city: optionalText(60),
  countryCode: country,
  benefits: z.array(text(80).min(2)).max(20),
  values: z.array(text(40).min(2)).max(10),
  cultureText: optionalText(3000),
  brandColor: hexColor,
});

export const skillUpdateSchema = z.object({
  level: z.enum(SKILL_LEVELS).optional(),
  years: z.coerce.number().min(0).max(60).nullable().optional(),
  isTop: z.boolean().optional(),
});
