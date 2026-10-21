import "server-only";
import type { EmploymentType, ExperienceLevel, JobSource, SalaryPeriod, WorkMode } from "@/generated/prisma/client";
import { COUNTRY_CODES } from "@/lib/geo";

/** One listing from any source, already in the shape of our `jobs` table. */
export type NormalizedJob = {
  source: JobSource;
  externalId: string;
  /** The original listing — where people apply (and the attribution link). */
  externalUrl: string;
  title: string;
  description: string;
  summary: string | null;
  companyName: string;
  companyLogo: string | null;
  workMode: WorkMode;
  employmentType: EmploymentType;
  experienceLevel: ExperienceLevel;
  city: string | null;
  countryCode: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  salaryPeriod: SalaryPeriod | null;
  closesAt: Date | null;
};

export const SOURCE_NAMES: Record<JobSource, string> = { ARBEITNOW: "Arbeitnow", JOBICY: "Jobicy", HIMALAYAS: "Himalayas" };

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);
export const text = (v: unknown, max = 200) => (typeof v === "string" ? clip(v.replace(/\s+/g, " ").trim(), max) : "");
export const list = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : typeof v === "string" ? [v] : []);

/** Only absolute http(s) links are stored (logos, listings). */
export function safeUrl(v: unknown): string | null {
  if (typeof v !== "string") return null;
  try {
    const u = new URL(v);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", hellip: "…", ndash: "–", mdash: "—", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", bull: "•", euro: "€" };

/** Listing HTML → the plain text our job page shows (paragraphs separated by blank lines, list items as bullets). */
export function htmlToText(html: unknown, max = 20000): string {
  if (typeof html !== "string") return "";
  let s = convertHtml(html);
  // Some feeds send their HTML escaped ("&lt;p&gt;…"): decoding reveals real tags, so convert once more.
  if (/<\/?[a-z][^>]*>/i.test(s)) s = convertHtml(s);
  return clip(s, max);
}

function convertHtml(html: string): string {
  return html
    .replace(/<\s*(script|style)[^>]*>[\s\S]*?<\/\s*\1\s*>/gi, "")
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\s*li[^>]*>/gi, "\n• ")
    .replace(/<\/\s*(p|div|h[1-6]|ul|ol|section|article|blockquote|tr)\s*>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
      if (e[0] === "#") {
        const code = e[1]?.toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : "";
      }
      return ENTITIES[e.toLowerCase()] ?? m;
    })
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Free-text job types ("Full-Time", "Teilzeit", "Contract", "Praktikum", …) → our enum. */
export function employmentTypeFrom(values: string[]): EmploymentType {
  const s = values.join(" ").toLowerCase();
  if (/intern|praktik|werkstudent|trainee/.test(s)) return "INTERNSHIP";
  if (/part[\s-]?time|teilzeit/.test(s)) return "PART_TIME";
  if (/freelanc/.test(s)) return "FREELANCE";
  if (/contract|contractor|temporary/.test(s)) return "CONTRACT";
  return "FULL_TIME";
}

/** Seniority words in the level field or the title → our enum (defaults to MID). */
export function experienceLevelFrom(values: string[], title: string): ExperienceLevel {
  const level = values.join(" ").toLowerCase();
  const s = `${level} ${title}`.toLowerCase();
  if (/\b(intern|internship|praktik|werkstudent)/.test(s)) return "INTERNSHIP";
  // "Executive" in a title is usually a sales role ("Account Executive"); only the level field means seniority.
  if (/\b(chief|vp|vice president|director|c-level)\b/.test(s) || /\bexecutive\b/.test(level)) return "EXECUTIVE";
  if (/\b(lead|principal|staff|head of)\b/.test(s)) return "LEAD";
  if (/\b(senior|sr\.?|expert)\b/.test(s)) return "SENIOR";
  if (/\b(junior|jr\.?|entry|graduate|berufseinsteiger)\b/.test(s)) return "ENTRY";
  return "MID";
}

export function salaryPeriodFrom(v: unknown): SalaryPeriod | null {
  const s = typeof v === "string" ? v.toLowerCase() : "";
  if (/year|annual/.test(s)) return "YEAR";
  if (/month/.test(s)) return "MONTH";
  if (/hour/.test(s)) return "HOUR";
  return null;
}

export function salaryFrom(min: unknown, max: unknown, currency: unknown) {
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 && v < 100_000_000 ? Math.round(v) : null);
  const cur = typeof currency === "string" && /^[A-Za-z]{3}$/.test(currency) ? currency.toUpperCase() : null;
  const lo = n(min);
  const hi = n(max);
  if (!cur || (lo === null && hi === null)) return { salaryMin: null, salaryMax: null, salaryCurrency: null };
  return { salaryMin: lo, salaryMax: hi !== null && lo !== null && hi < lo ? null : hi, salaryCurrency: cur };
}

// English country names (and common short forms) → ISO code, for "USA", "United Kingdom", "Germany", …
const regionNames = new Intl.DisplayNames(["en"], { type: "region" });
const COUNTRY_BY_NAME = new Map<string, string>([
  ...COUNTRY_CODES.map((c) => [(regionNames.of(c) ?? c).toLowerCase(), c] as [string, string]),
  ...COUNTRY_CODES.map((c) => [c.toLowerCase(), c] as [string, string]),
  ["usa", "US"],
  ["united states of america", "US"],
  ["uk", "GB"],
  ["england", "GB"],
  ["uae", "AE"],
  ["deutschland", "DE"],
]);

/** A country code only when the listing names exactly one country ("Anywhere", "Europe", "USA, Canada" → null). */
export function singleCountry(values: string[]): string | null {
  const parts = values.flatMap((v) => v.split(/[,;/|]/)).map((p) => p.trim().toLowerCase()).filter(Boolean);
  const codes = new Set(parts.map((p) => COUNTRY_BY_NAME.get(p)).filter((c): c is string => !!c));
  return codes.size === 1 && parts.length === 1 ? [...codes][0]! : null;
}
