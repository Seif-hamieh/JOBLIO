/**
 * JOBLIO transparent matching engine — rule-based, no AI or ML.
 *
 * A match score is a weighted average of independent criteria. Each criterion
 * earns between 0 and its weight in points using fixed, documented rules.
 * Criteria that cannot be evaluated (the job doesn't state a salary, the
 * candidate hasn't set a preference…) are marked "not applicable" and removed
 * from the denominator, so missing data never silently counts for or against.
 *
 *   score = round(100 × Σ earned / Σ weight of applicable criteria)
 *
 * The same function powers "Jobs For You" (seeker perspective) and candidate
 * ranking for recruiters (recruiter perspective — adds availability).
 *
 * Explanations are returned as reason codes + variables (`reasons`) so the UI
 * can render them in any language; `detail` is the English rendering.
 */

import {
  EDUCATION_LEVEL_LABEL,
  EDUCATION_RANK,
  EMPLOYMENT_TYPE_LABEL,
  PROFICIENCY_RANK,
  SKILL_RANK,
  WORK_MODE_LABEL,
  type Availability,
  type EducationLevel,
  type EmploymentType,
  type LanguageProficiency,
  type SalaryPeriod,
  type SkillLevel,
  type WorkMode,
} from "@/lib/constants";

export const MATCH_WEIGHTS = {
  skills: 35,
  experience: 20,
  location: 12,
  employmentType: 8,
  salary: 7,
  education: 6,
  languages: 5,
  industry: 4,
  availability: 3,
} as const;

export type CriterionKey = keyof typeof MATCH_WEIGHTS;
export type CriterionStatus = "met" | "partial" | "missed" | "na";

export const CRITERION_LABEL: Record<CriterionKey, string> = {
  skills: "Skills",
  experience: "Experience",
  location: "Location & work mode",
  employmentType: "Job type",
  salary: "Salary",
  education: "Education",
  languages: "Languages",
  industry: "Industry",
  availability: "Availability",
};

/** Credit for a skill held at a given level vs. the level a job asks for. */
export const SKILL_LEVEL_CREDIT = { atOrAbove: 1, oneBelow: 0.6, twoOrMoreBelow: 0.3 } as const;
/** Nice-to-have skills count half as much as required ones. */
export const PREFERRED_SKILL_FACTOR = 0.5;

export interface CandidateFacts {
  skills: { skillId: string; name: string; level: SkillLevel }[];
  yearsExperience: number;
  educationLevel: EducationLevel;
  city: string | null;
  countryCode: string | null;
  preferredCities: string[];
  openToRelocate: boolean;
  preferredWorkModes: WorkMode[];
  preferredEmploymentTypes: EmploymentType[];
  desiredSalaryMin: number | null;
  salaryCurrency: string;
  salaryPeriod: SalaryPeriod;
  languages: { code: string; proficiency: LanguageProficiency }[];
  preferredIndustryIds: string[];
  availability: Availability;
}

export interface JobFacts {
  skills: { skillId: string; name: string; required: boolean; minLevel: SkillLevel }[];
  minYearsExperience: number;
  educationLevel: EducationLevel;
  workMode: WorkMode;
  employmentType: EmploymentType;
  city: string | null;
  countryCode: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string;
  salaryPeriod: SalaryPeriod;
  languages: { code: string; minProficiency: LanguageProficiency }[];
  industryId: string | null;
  industryName?: string | null;
}

/** A translatable explanation fragment. Variables named mode/modes/type/level hold enum codes. */
export type Reason = { key: string; vars?: Record<string, string | number> };

export interface CriterionResult {
  key: CriterionKey;
  label: string;
  weight: number;
  /** Points earned, 0..weight (0 when not applicable). */
  earned: number;
  status: CriterionStatus;
  /** How the points were awarded, as reason codes (joined with " · "). */
  reasons: Reason[];
  /** English rendering of `reasons`. */
  detail: string;
}

export interface MatchResult {
  score: number;
  criteria: CriterionResult[];
  matchedSkills: string[];
  missingSkills: string[];
  /** Short positive reasons for list cards, e.g. "8 matching skills". */
  highlights: Reason[];
}

export type Perspective = "seeker" | "recruiter";

// English templates (the UI has equivalents in every dictionary under `match.r`).
export const EN_REASONS: Record<string, string> = {
  noSkills: "No specific skills listed",
  reqSkills: "{got}/{total} required skills",
  prefSkills: "{got}/{total} nice-to-have",
  belowLevel: "{n} skill(s) below the requested level",
  noMinExp: "No minimum experience required · {years} yrs experience",
  expMeets: "{years} yrs experience · {min}+ required",
  expShort: "{years} of {min}+ years required",
  remoteOk: "Remote role · remote compatible",
  remotePrefers: "Remote role · prefers {modes}",
  modeRole: "{mode} role",
  inPreferred: "{mode} in {place} · preferred location",
  sameCountry: "{mode} in {place} · same country",
  relocation: "{mode} in {place} · open to relocation",
  outside: "{mode} in {place} · outside preferred locations",
  prefersModes: "prefers {modes}",
  noTypePref: "No job type preference set",
  typeMatch: "{type} · matches preference",
  typeMismatch: "{type} · not in preferred job types",
  notDisclosed: "Salary not disclosed",
  noExpectation: "No salary expectation set",
  diffCurrency: "Different currency ({currency})",
  salaryMeets: "Salary range meets expectation",
  salaryBelow: "Range tops out {pct}% below expectation",
  noDegree: "No degree requirement",
  eduMet: "{level} required · requirement met",
  eduOneBelow: "{level} required · one level below",
  eduRequired: "{level} required",
  noLangs: "No language requirements",
  langs: "{got}/{total} required languages",
  noIndustry: "Industry not specified",
  noIndustryPref: "No industry preference set",
  industryMatch: "{name} · preferred industry",
  industryMismatch: "{name} · outside preferred industries",
  availIMMEDIATELY: "Available now",
  availTWO_WEEKS: "Available within 2 weeks",
  availONE_MONTH: "Available within a month",
  availTHREE_MONTHS: "Available within 3 months",
  availNOT_LOOKING: "Not actively looking",
  recruiterOnly: "Only used when recruiters rank candidates",
  hlSkills: "{n} matching skill(s)",
  hlExperience: "Required experience",
  hlRemote: "Remote compatible",
  hlLocation: "Preferred location",
  hlSalary: "Salary fits",
  hlType: "{type}",
};

const enVar = (name: string, v: string | number) => {
  if (typeof v === "number") return String(v);
  if (name === "mode") return WORK_MODE_LABEL[v as WorkMode] ?? v;
  if (name === "modes") return v.split(",").map((m) => WORK_MODE_LABEL[m as WorkMode] ?? m).join(" / ");
  if (name === "type") return EMPLOYMENT_TYPE_LABEL[v as EmploymentType] ?? v;
  if (name === "level") return EDUCATION_LEVEL_LABEL[v as EducationLevel] ?? v;
  return v;
};

export function renderReasonEn(r: Reason) {
  const tpl = EN_REASONS[r.key] ?? r.key;
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => (r.vars && k in r.vars ? enVar(k, r.vars[k]!) : `{${k}}`));
}

const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();
const yrs = (y: number) => Math.round(y * 10) / 10;

function statusFor(ratio: number): CriterionStatus {
  if (ratio >= 0.999) return "met";
  if (ratio > 0) return "partial";
  return "missed";
}

function result(key: CriterionKey, ratio: number, reasons: Reason[], status?: CriterionStatus): CriterionResult {
  const weight = MATCH_WEIGHTS[key];
  const r = Math.max(0, Math.min(1, ratio));
  return {
    key,
    label: CRITERION_LABEL[key],
    weight,
    earned: Math.round(weight * r * 10) / 10,
    status: status ?? statusFor(r),
    reasons,
    detail: reasons.map(renderReasonEn).join(" · "),
  };
}

function notApplicable(key: CriterionKey, reason: Reason): CriterionResult {
  return { key, label: CRITERION_LABEL[key], weight: MATCH_WEIGHTS[key], earned: 0, status: "na", reasons: [reason], detail: renderReasonEn(reason) };
}

export function skillCredit(held: SkillLevel | undefined, required: SkillLevel) {
  if (!held) return 0;
  const gap = SKILL_RANK[required] - SKILL_RANK[held];
  if (gap <= 0) return SKILL_LEVEL_CREDIT.atOrAbove;
  if (gap === 1) return SKILL_LEVEL_CREDIT.oneBelow;
  return SKILL_LEVEL_CREDIT.twoOrMoreBelow;
}

function scoreSkills(c: CandidateFacts, j: JobFacts) {
  if (j.skills.length === 0) return { res: notApplicable("skills", { key: "noSkills" }), matched: [], missing: [] };
  const held = new Map(c.skills.map((s) => [s.skillId, s.level]));
  let earned = 0;
  let possible = 0;
  let reqFull = 0;
  let reqTotal = 0;
  let prefFull = 0;
  let prefTotal = 0;
  const matched: string[] = [];
  const missing: string[] = [];
  for (const s of j.skills) {
    const w = s.required ? 1 : PREFERRED_SKILL_FACTOR;
    const credit = skillCredit(held.get(s.skillId), s.minLevel);
    earned += credit * w;
    possible += w;
    if (credit > 0) matched.push(s.name);
    else if (s.required) missing.push(s.name);
    if (s.required) {
      reqTotal++;
      if (credit === 1) reqFull++;
    } else {
      prefTotal++;
      if (credit === 1) prefFull++;
    }
  }
  const reasons: Reason[] = [];
  if (reqTotal) reasons.push({ key: "reqSkills", vars: { got: reqFull, total: reqTotal } });
  if (prefTotal) reasons.push({ key: "prefSkills", vars: { got: prefFull, total: prefTotal } });
  const partialCount = matched.length - reqFull - prefFull;
  if (partialCount > 0) reasons.push({ key: "belowLevel", vars: { n: partialCount } });
  return { res: result("skills", earned / possible, reasons), matched, missing };
}

function scoreExperience(c: CandidateFacts, j: JobFacts) {
  const min = j.minYearsExperience;
  const years = yrs(c.yearsExperience);
  if (min <= 0) return result("experience", 1, [{ key: "noMinExp", vars: { years } }]);
  if (c.yearsExperience >= min) return result("experience", 1, [{ key: "expMeets", vars: { years, min } }]);
  // Partial credit proportional to the share of required years, capped below full.
  return result("experience", Math.min(0.9, c.yearsExperience / min), [{ key: "expShort", vars: { years, min } }]);
}

function scoreLocation(c: CandidateFacts, j: JobFacts) {
  const modeOk = c.preferredWorkModes.length === 0 || c.preferredWorkModes.includes(j.workMode);
  const modes = c.preferredWorkModes.join(",");
  if (j.workMode === "REMOTE") {
    return modeOk ? result("location", 1, [{ key: "remoteOk" }]) : result("location", 0.5, [{ key: "remotePrefers", vars: { modes } }]);
  }
  const modeFactor = modeOk ? 1 : 0.7;
  const modeNote: Reason[] = modeOk ? [] : [{ key: "prefersModes", vars: { modes } }];
  const mode = j.workMode;
  if (!j.city && !j.countryCode) return result("location", modeFactor, [{ key: "modeRole", vars: { mode } }, ...modeNote]);

  const jobCity = norm(j.city);
  const sameCountry = !!j.countryCode && norm(j.countryCode) === norm(c.countryCode);
  const preferredCity = c.preferredCities.map(norm).includes(jobCity);
  const cityMatch = !!jobCity && (jobCity === norm(c.city) || preferredCity);
  const place = j.city ?? j.countryCode ?? "";

  let geo: number;
  let key: string;
  if (cityMatch && (sameCountry || !j.countryCode || preferredCity)) {
    geo = 1;
    key = "inPreferred";
  } else if (sameCountry) {
    geo = 0.6;
    key = "sameCountry";
  } else if (c.openToRelocate) {
    geo = 0.5;
    key = "relocation";
  } else {
    geo = 0;
    key = "outside";
  }
  return result("location", geo * modeFactor, [{ key, vars: { mode, place } }, ...modeNote]);
}

function scoreEmploymentType(c: CandidateFacts, j: JobFacts) {
  if (c.preferredEmploymentTypes.length === 0) return notApplicable("employmentType", { key: "noTypePref" });
  return c.preferredEmploymentTypes.includes(j.employmentType)
    ? result("employmentType", 1, [{ key: "typeMatch", vars: { type: j.employmentType } }])
    : result("employmentType", 0, [{ key: "typeMismatch", vars: { type: j.employmentType } }]);
}

const PERIOD_TO_YEAR: Record<SalaryPeriod, number> = { HOUR: 2080, MONTH: 12, YEAR: 1 };
export const toYearly = (amount: number, period: SalaryPeriod) => amount * PERIOD_TO_YEAR[period];

function scoreSalary(c: CandidateFacts, j: JobFacts) {
  const jobTop = j.salaryMax ?? j.salaryMin;
  if (jobTop == null) return notApplicable("salary", { key: "notDisclosed" });
  if (c.desiredSalaryMin == null) return notApplicable("salary", { key: "noExpectation" });
  if (norm(c.salaryCurrency) !== norm(j.salaryCurrency)) {
    // No FX conversion by design: rates change and would need a paid feed.
    return notApplicable("salary", { key: "diffCurrency", vars: { currency: j.salaryCurrency } });
  }
  const offered = toYearly(jobTop, j.salaryPeriod);
  const wanted = toYearly(c.desiredSalaryMin, c.salaryPeriod);
  if (offered >= wanted) return result("salary", 1, [{ key: "salaryMeets" }]);
  const ratio = offered / wanted;
  // Within 15% below expectation earns partial credit, scaled linearly.
  const credit = ratio >= 0.85 ? (ratio - 0.85) / 0.15 : 0;
  return result("salary", credit, [{ key: "salaryBelow", vars: { pct: Math.round((1 - ratio) * 100) } }]);
}

function scoreEducation(c: CandidateFacts, j: JobFacts) {
  if (j.educationLevel === "NONE") return result("education", 1, [{ key: "noDegree" }]);
  const gap = EDUCATION_RANK[j.educationLevel] - EDUCATION_RANK[c.educationLevel];
  const level = j.educationLevel;
  if (gap <= 0) return result("education", 1, [{ key: "eduMet", vars: { level } }]);
  if (gap === 1) return result("education", 0.5, [{ key: "eduOneBelow", vars: { level } }]);
  return result("education", 0, [{ key: "eduRequired", vars: { level } }]);
}

function scoreLanguages(c: CandidateFacts, j: JobFacts) {
  if (j.languages.length === 0) return notApplicable("languages", { key: "noLangs" });
  const held = new Map(c.languages.map((l) => [norm(l.code), l.proficiency]));
  let credit = 0;
  let full = 0;
  for (const l of j.languages) {
    const p = held.get(norm(l.code));
    if (!p) continue;
    const gap = PROFICIENCY_RANK[l.minProficiency] - PROFICIENCY_RANK[p];
    if (gap <= 0) {
      credit += 1;
      full++;
    } else if (gap === 1) credit += 0.5;
  }
  return result("languages", credit / j.languages.length, [{ key: "langs", vars: { got: full, total: j.languages.length } }]);
}

function scoreIndustry(c: CandidateFacts, j: JobFacts) {
  if (!j.industryId) return notApplicable("industry", { key: "noIndustry" });
  if (c.preferredIndustryIds.length === 0) return notApplicable("industry", { key: "noIndustryPref" });
  const name = j.industryName ?? "—";
  return c.preferredIndustryIds.includes(j.industryId)
    ? result("industry", 1, [{ key: "industryMatch", vars: { name } }])
    : result("industry", 0, [{ key: "industryMismatch", vars: { name } }]);
}

const AVAILABILITY_CREDIT: Record<Availability, number> = { IMMEDIATELY: 1, TWO_WEEKS: 1, ONE_MONTH: 0.8, THREE_MONTHS: 0.5, NOT_LOOKING: 0.2 };

function scoreAvailability(c: CandidateFacts) {
  return result("availability", AVAILABILITY_CREDIT[c.availability], [{ key: `avail${c.availability}` }]);
}

export function computeMatch(candidate: CandidateFacts, job: JobFacts, perspective: Perspective = "seeker"): MatchResult {
  const skills = scoreSkills(candidate, job);
  const criteria: CriterionResult[] = [
    skills.res,
    scoreExperience(candidate, job),
    scoreLocation(candidate, job),
    scoreEmploymentType(candidate, job),
    scoreSalary(candidate, job),
    scoreEducation(candidate, job),
    scoreLanguages(candidate, job),
    scoreIndustry(candidate, job),
    perspective === "recruiter" ? scoreAvailability(candidate) : notApplicable("availability", { key: "recruiterOnly" }),
  ];

  const applicable = criteria.filter((c) => c.status !== "na");
  const possible = applicable.reduce((s, c) => s + c.weight, 0);
  const earned = applicable.reduce((s, c) => s + c.earned, 0);
  const score = possible === 0 ? 0 : Math.round((earned / possible) * 100);

  const highlights: Reason[] = [];
  if (skills.matched.length) highlights.push({ key: "hlSkills", vars: { n: skills.matched.length } });
  if (criteria[1]!.status === "met" && job.minYearsExperience > 0) highlights.push({ key: "hlExperience" });
  if (criteria[2]!.status === "met") highlights.push({ key: job.workMode === "REMOTE" ? "hlRemote" : "hlLocation" });
  if (criteria[4]!.status === "met") highlights.push({ key: "hlSalary" });
  if (criteria[3]!.status === "met") highlights.push({ key: "hlType", vars: { type: job.employmentType } });

  return { score, criteria, matchedSkills: skills.matched, missingSkills: skills.missing, highlights };
}

/** Tier used for colour-coding badges. */
export function matchTier(score: number): "excellent" | "strong" | "fair" | "low" {
  if (score >= 85) return "excellent";
  if (score >= 70) return "strong";
  if (score >= 50) return "fair";
  return "low";
}
