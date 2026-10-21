import "server-only";
import { employmentTypeFrom, experienceLevelFrom, htmlToText, list, safeUrl, salaryFrom, salaryPeriodFrom, singleCountry, text, type NormalizedJob } from "../normalize";
import { fetchJson, isRecord } from "./fetch-json";

// https://himalayas.app/jobs/api — free, no key; remote jobs, 20 per request, refreshed daily.
// Terms: use `applicationLink` unchanged for Apply, show Himalayas as the source, don't pass the jobs to
// Google Jobs (so imported jobs get no JobPosting JSON-LD), remove them once they expire (expiryDate → closesAt).
//
// Two passes, merged and de-duplicated on `guid`:
//   1. Global — the newest jobs from the browse endpoint (unchanged).
//   2. MENA — the newest jobs open to each Arab country (search endpoint, country filter), kept only when
//      their location list names one of MENA_KEYWORDS.
const BASE = "https://himalayas.app/jobs/api";
const SEARCH = "https://himalayas.app/jobs/api/search";
const PAGES = 2; // 40 newest global jobs a day — the keyless allowance is shared by every caller.

// Countries searched for the MENA pass (ISO codes — the search API rejects regions like "Middle East").
const MENA_COUNTRIES = ["AE", "SA", "EG", "JO", "LB", "QA", "KW", "BH", "OM", "MA", "DZ", "TN"] as const;
// A MENA job's `locationRestrictions` must name one of these (case-insensitive; whole words for the short ones).
export const MENA_KEYWORDS = [
  "UAE",
  "United Arab Emirates",
  "Saudi Arabia",
  "Egypt",
  "Jordan",
  "Lebanon",
  "Qatar",
  "Kuwait",
  "Bahrain",
  "Oman",
  "Morocco",
  "Algeria",
  "Tunisia",
  "MENA",
  "Middle East",
];
const MENA_PATTERN = new RegExp(`\\b(${MENA_KEYWORDS.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`, "i");

/** True when a job's location restrictions mention an Arab country or the MENA region. */
export function isMenaJob(locations: string[]) {
  return locations.some((l) => MENA_PATTERN.test(l));
}

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** One Himalayas job object → our shape (null when a required field is missing). */
function normalize(r: Record<string, unknown>): NormalizedJob | null {
  const externalUrl = safeUrl(r.applicationLink);
  // `guid` is the stable listing URL; applicationLink carries tracking parameters.
  const externalId = text(r.guid, 300) || text(r.applicationLink, 300);
  const title = text(r.title);
  const companyName = text(r.companyName, 120);
  const description = htmlToText(r.description);
  if (!externalId || !externalUrl || !title || !companyName || !description) return null;
  const salary = salaryFrom(r.minSalary, r.maxSalary, r.currency);
  const expiry = typeof r.expiryDate === "number" ? new Date(r.expiryDate * 1000) : null;
  return {
    source: "HIMALAYAS",
    externalId,
    externalUrl,
    title,
    description,
    summary: text(r.excerpt, 280) || null,
    companyName,
    companyLogo: safeUrl(r.companyLogo),
    workMode: "REMOTE",
    employmentType: employmentTypeFrom(list(r.employmentType)),
    experienceLevel: experienceLevelFrom(list(r.seniority), title),
    city: null,
    countryCode: singleCountry(list(r.locationRestrictions)),
    ...salary,
    salaryPeriod: salary.salaryCurrency ? salaryPeriodFrom(r.salaryPeriod) : null,
    closesAt: expiry && !Number.isNaN(expiry.getTime()) ? expiry : null,
  };
}

const jobsIn = (body: unknown): Record<string, unknown>[] => (isRecord(body) && Array.isArray(body.jobs) ? body.jobs.filter(isRecord) : []);

/** Pass 1: the newest jobs worldwide (browse endpoint, cursor pages). */
async function fetchGlobal(): Promise<NormalizedJob[]> {
  const jobs: NormalizedJob[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < PAGES; page++) {
    const body = await fetchJson(cursor ? `${BASE}?cursor=${encodeURIComponent(cursor)}` : BASE);
    for (const r of jobsIn(body)) {
      const job = normalize(r);
      if (job) jobs.push(job);
    }
    cursor = isRecord(body) && typeof body.nextCursor === "string" && body.nextCursor ? body.nextCursor : null;
    if (!cursor) break;
  }
  return jobs;
}

/**
 * Pass 2: the newest jobs open to each Arab country (first page per country, country-specific only —
 * worldwide jobs already come from pass 1). One country failing doesn't stop the others.
 */
async function fetchMena(): Promise<NormalizedJob[]> {
  const jobs: NormalizedJob[] = [];
  for (const country of MENA_COUNTRIES) {
    try {
      const body = await fetchJson(`${SEARCH}?country=${country}&exclude_worldwide=true&sort=recent`, 15_000);
      for (const r of jobsIn(body)) {
        if (!isMenaJob(list(r.locationRestrictions))) continue;
        const job = normalize(r);
        if (job) jobs.push(job);
      }
    } catch (e) {
      console.warn(`[job-import] Himalayas MENA search for ${country} failed:`, e instanceof Error ? e.message : e);
    }
    await pause(250); // be gentle with the shared keyless allowance
  }
  return jobs;
}

export async function fetchHimalayas(): Promise<NormalizedJob[]> {
  const global = await fetchGlobal();
  const mena = await fetchMena();
  // Same listing in both passes (or in several countries' results): keep the first copy.
  return [...new Map([...global, ...mena].map((j) => [j.externalId, j])).values()];
}
