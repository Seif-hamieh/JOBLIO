// schema.org JobPosting for search engines (Google for Jobs). Built only from
// data shown on the job page.

type JobForLd = {
  id: string;
  title: string;
  description: string;
  responsibilities: string[];
  requirements: string[];
  publishedAt: Date | null;
  createdAt: Date;
  closesAt: Date | null;
  employmentType: "FULL_TIME" | "PART_TIME" | "CONTRACT" | "FREELANCE" | "INTERNSHIP";
  workMode: "REMOTE" | "HYBRID" | "ONSITE" | string;
  city: string | null;
  countryCode: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string;
  salaryPeriod: "HOUR" | "MONTH" | "YEAR";
  company: { name: string; slug: string; logoUrl: string | null; website: string | null; city: string | null; countryCode: string | null };
};

const EMPLOYMENT: Record<JobForLd["employmentType"], string> = {
  FULL_TIME: "FULL_TIME",
  PART_TIME: "PART_TIME",
  CONTRACT: "CONTRACTOR",
  FREELANCE: "CONTRACTOR",
  INTERNSHIP: "INTERN",
};

const DAY_MS = 86_400_000;
const DEFAULT_REMOTE_COUNTRY = "LB";

const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);

export function jobPostingJsonLd(job: JobForLd, siteUrl: string) {
  const abs = (u: string | null) => (u ? (u.startsWith("http") ? u : `${siteUrl}${u}`) : undefined);
  // Description accepts basic HTML: paragraphs plus the two lists.
  const html = [
    ...job.description.split(/\n{2,}/).map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`),
    job.responsibilities.length ? `<ul>${job.responsibilities.map((r) => `<li>${esc(r)}</li>`).join("")}</ul>` : "",
    job.requirements.length ? `<ul>${job.requirements.map((r) => `<li>${esc(r)}</li>`).join("")}</ul>` : "",
  ].join("");
  const remote = job.workMode === "REMOTE";
  // The job's own location, else the company's.
  const city = job.city ?? job.company.city;
  const country = job.countryCode ?? job.company.countryCode;
  // Google requires applicantLocationRequirements for remote jobs: default to Lebanon when unknown.
  const remoteCountry = country ?? DEFAULT_REMOTE_COUNTRY;
  const salary = job.salaryMin != null || job.salaryMax != null;
  const posted = job.publishedAt ?? job.createdAt;
  // closesAt is the closing *day* (00:00 UTC) and the job stays open through it: end of that day.
  // Without one: 30 days after posting, but never already past while the job is still open
  // (an expired validThrough makes Google drop a live job), so older jobs roll forward 30 days.
  const validThrough = job.closesAt
    ? new Date(job.closesAt.getTime() + DAY_MS - 1000)
    : new Date(Math.max(posted.getTime(), Date.now()) + 30 * DAY_MS);

  return {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: job.title,
    description: html,
    identifier: { "@type": "PropertyValue", name: "JOBLIO", value: job.id },
    datePosted: posted.toISOString(),
    validThrough: validThrough.toISOString(),
    employmentType: EMPLOYMENT[job.employmentType],
    url: `${siteUrl}/jobs/${job.id}`,
    hiringOrganization: {
      "@type": "Organization",
      name: job.company.name,
      ...(job.company.website && { sameAs: job.company.website }),
      ...(job.company.logoUrl && { logo: abs(job.company.logoUrl) }),
    },
    ...(remote ? { jobLocationType: "TELECOMMUTE", applicantLocationRequirements: { "@type": "Country", name: remoteCountry } } : {}),
    ...((!remote || city) && (city || country)
      ? { jobLocation: { "@type": "Place", address: { "@type": "PostalAddress", ...(city && { addressLocality: city }), ...(country && { addressCountry: country }) } } }
      : {}),
    ...(salary && {
      baseSalary: {
        "@type": "MonetaryAmount",
        currency: job.salaryCurrency,
        value: {
          "@type": "QuantitativeValue",
          ...(job.salaryMin != null && { minValue: job.salaryMin }),
          ...(job.salaryMax != null && { maxValue: job.salaryMax }),
          unitText: job.salaryPeriod,
        },
      },
    }),
  };
}

/** Serialises JSON-LD safely for a <script> tag. */
export const jsonLdScript = (data: unknown) => JSON.stringify(data).replace(/</g, "\\u003c");
