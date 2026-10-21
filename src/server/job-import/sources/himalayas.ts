import "server-only";
import { employmentTypeFrom, experienceLevelFrom, htmlToText, list, safeUrl, salaryFrom, salaryPeriodFrom, singleCountry, text, type NormalizedJob } from "../normalize";
import { fetchJson, isRecord } from "./fetch-json";

// https://himalayas.app/jobs/api — free, no key; remote jobs, 20 per request, refreshed daily.
// Terms: use `applicationLink` unchanged for Apply, show Himalayas as the source, don't pass the jobs to
// Google Jobs (so imported jobs get no JobPosting JSON-LD), remove them once they expire (expiryDate → closesAt).
const BASE = "https://himalayas.app/jobs/api";
const PAGES = 2; // 40 newest jobs a day — the keyless allowance is shared by every caller.

export async function fetchHimalayas(): Promise<NormalizedJob[]> {
  const jobs: NormalizedJob[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < PAGES; page++) {
    const body = await fetchJson(cursor ? `${BASE}?cursor=${encodeURIComponent(cursor)}` : BASE);
    if (!isRecord(body)) break;
    for (const r of Array.isArray(body.jobs) ? body.jobs : []) {
      if (!isRecord(r)) continue;
      const externalUrl = safeUrl(r.applicationLink);
      // `guid` is the stable listing URL; applicationLink carries tracking parameters.
      const externalId = text(r.guid, 300) || text(r.applicationLink, 300);
      const title = text(r.title);
      const companyName = text(r.companyName, 120);
      const description = htmlToText(r.description);
      if (!externalId || !externalUrl || !title || !companyName || !description) continue;
      const salary = salaryFrom(r.minSalary, r.maxSalary, r.currency);
      const expiry = typeof r.expiryDate === "number" ? new Date(r.expiryDate * 1000) : null;
      jobs.push({
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
      });
    }
    cursor = typeof body.nextCursor === "string" && body.nextCursor ? body.nextCursor : null;
    if (!cursor) break;
  }
  return jobs;
}
