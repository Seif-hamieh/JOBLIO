import "server-only";
import { employmentTypeFrom, experienceLevelFrom, htmlToText, list, safeUrl, text, type NormalizedJob } from "../normalize";
import { fetchJson, isRecord } from "./fetch-json";

// https://www.arbeitnow.com/api/job-board-api — free, no key; newest first, 300 per page, updated hourly.
// Mostly jobs in Germany (many in German). No logos in the feed. Their notice asks for a link back.
const URL = "https://www.arbeitnow.com/api/job-board-api";

export async function fetchArbeitnow(): Promise<NormalizedJob[]> {
  const body = await fetchJson(URL);
  const rows = isRecord(body) && Array.isArray(body.data) ? body.data : [];
  const jobs: NormalizedJob[] = [];
  for (const r of rows) {
    if (!isRecord(r)) continue;
    const externalId = text(r.slug, 200);
    const externalUrl = safeUrl(r.url);
    const title = text(r.title);
    const companyName = text(r.company_name, 120);
    const description = htmlToText(r.description);
    if (!externalId || !externalUrl || !title || !companyName || !description) continue;
    const types = list(r.job_types);
    const remote = r.remote === true;
    jobs.push({
      source: "ARBEITNOW",
      externalId,
      externalUrl,
      title,
      description,
      summary: null,
      companyName,
      companyLogo: null,
      workMode: remote ? "REMOTE" : "ONSITE",
      employmentType: employmentTypeFrom(types),
      experienceLevel: experienceLevelFrom(types, title),
      city: text(r.location, 100) || null,
      countryCode: null,
      salaryMin: null,
      salaryMax: null,
      salaryCurrency: null,
      salaryPeriod: null,
      closesAt: null,
    });
  }
  return jobs;
}
