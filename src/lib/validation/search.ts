import { z } from "zod";
import {
  AVAILABILITIES,
  EDUCATION_LEVELS,
  EMPLOYMENT_TYPES,
  EXPERIENCE_LEVELS,
  SKILL_LEVELS,
  WORK_MODES,
} from "@/lib/constants";

type RawParams = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Comma-separated list of enum values in the URL, e.g. `mode=REMOTE,HYBRID`. */
const csvEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z
    .string()
    .optional()
    .transform((v) => (v ? v.split(",").filter((x): x is T[number] => (values as readonly string[]).includes(x)) : []));

const csvSlugs = z
  .string()
  .optional()
  .transform((v) =>
    v
      ? v
          .split(",")
          .map((s) => s.trim().toLowerCase())
          .filter((s) => /^[a-z0-9-]{1,60}$/.test(s))
          .slice(0, 10)
      : [],
  );

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || undefined);

export const jobSearchSchema = z.object({
  q: optionalText(100),
  location: optionalText(80),
  mode: csvEnum(WORK_MODES),
  type: csvEnum(EMPLOYMENT_TYPES),
  level: csvEnum(EXPERIENCE_LEVELS),
  salary: z.coerce.number().int().min(0).max(10_000_000).optional().catch(undefined),
  industry: optionalText(60),
  skills: csvSlugs,
  company: optionalText(80),
  posted: z.enum(["1", "7", "30"]).optional().catch(undefined),
  sort: z.enum(["relevant", "newest", "salary", "match"]).catch("relevant").default("relevant"),
  page: z.coerce.number().int().min(1).max(500).catch(1).default(1),
});
export type JobSearchParams = z.infer<typeof jobSearchSchema>;

export function parseJobSearch(raw: RawParams): JobSearchParams {
  const flat = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, first(v)]));
  return jobSearchSchema.parse(flat);
}

export const candidateSearchSchema = z.object({
  q: optionalText(100),
  location: optionalText(80),
  skills: csvSlugs,
  skillLevel: z.enum(SKILL_LEVELS).optional().catch(undefined),
  minYears: z.coerce.number().min(0).max(50).optional().catch(undefined),
  education: z.enum(EDUCATION_LEVELS).optional().catch(undefined),
  languages: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(",").filter((x) => /^[a-z]{2,3}$/.test(x)).slice(0, 5) : [])),
  availability: csvEnum(AVAILABILITIES),
  remote: z.enum(["1"]).optional().catch(undefined),
  maxSalary: z.coerce.number().int().min(0).max(10_000_000).optional().catch(undefined),
  openToWork: z.enum(["1"]).optional().catch(undefined),
  job: optionalText(40),
  sort: z.enum(["match", "experience", "recent"]).catch("match").default("match"),
  page: z.coerce.number().int().min(1).max(200).catch(1).default(1),
});
export type CandidateSearchParams = z.infer<typeof candidateSearchSchema>;

export function parseCandidateSearch(raw: RawParams): CandidateSearchParams {
  const flat = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, first(v)]));
  return candidateSearchSchema.parse(flat);
}

/** Serialises search params back into a query string, dropping empties and default values. */
export function toQueryString(
  params: Record<string, unknown>,
  overrides: Record<string, unknown> = {},
  defaults: Record<string, unknown> = { page: 1, sort: "relevant" },
) {
  const merged = { ...params, ...overrides };
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) {
    if (v == null || v === "" || (Array.isArray(v) && v.length === 0)) continue;
    if (k in defaults && defaults[k] === v) continue;
    qs.set(k, Array.isArray(v) ? v.join(",") : String(v));
  }
  const s = qs.toString();
  return s ? `?${s}` : "";
}
