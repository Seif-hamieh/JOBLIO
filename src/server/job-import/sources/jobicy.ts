import "server-only";
import { employmentTypeFrom, experienceLevelFrom, htmlToText, list, safeUrl, salaryFrom, salaryPeriodFrom, singleCountry, text, type NormalizedJob } from "../normalize";
import { fetchJson, isRecord } from "./fetch-json";

// https://jobicy.com/api/v2/remote-jobs — free, no key; remote jobs only.
// Terms: credit Jobicy, keep the original Jobicy job URL, and send applicants to it; sync at most once an hour.
const URL = "https://jobicy.com/api/v2/remote-jobs?count=50";

export async function fetchJobicy(): Promise<NormalizedJob[]> {
  const body = await fetchJson(URL);
  const rows = isRecord(body) && Array.isArray(body.jobs) ? body.jobs : [];
  const jobs: NormalizedJob[] = [];
  for (const r of rows) {
    if (!isRecord(r)) continue;
    const externalId = typeof r.id === "number" || typeof r.id === "string" ? String(r.id) : "";
    const externalUrl = safeUrl(r.url);
    const title = text(r.jobTitle);
    const companyName = text(r.companyName, 120);
    const description = htmlToText(r.jobDescription);
    if (!externalId || !externalUrl || !title || !companyName || !description) continue;
    const level = list(r.jobLevel);
    const salary = salaryFrom(r.salaryMin, r.salaryMax, r.salaryCurrency);
    jobs.push({
      source: "JOBICY",
      externalId,
      externalUrl,
      title,
      description,
      summary: htmlToText(r.jobExcerpt, 280) || null,
      companyName,
      companyLogo: safeUrl(r.companyLogo),
      workMode: "REMOTE",
      employmentType: employmentTypeFrom(list(r.jobType)),
      experienceLevel: experienceLevelFrom(level, title),
      city: null,
      countryCode: singleCountry(list(r.jobGeo)),
      ...salary,
      salaryPeriod: salary.salaryCurrency ? salaryPeriodFrom(r.salaryPeriod) : null,
      closesAt: null,
    });
  }
  return jobs;
}
