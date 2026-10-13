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
  const city = job.city ?? job.company.city;
  const country = job.countryCode ?? job.company.countryCode;
  const salary = job.salaryMin != null || job.salaryMax != null;

  return {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: job.title,
    description: html,
    identifier: { "@type": "PropertyValue", name: "JOBLIO", value: job.id },
    datePosted: (job.publishedAt ?? job.createdAt).toISOString(),
    ...(job.closesAt && { validThrough: job.closesAt.toISOString() }),
    employmentType: EMPLOYMENT[job.employmentType],
    url: `${siteUrl}/jobs/${job.id}`,
    hiringOrganization: {
      "@type": "Organization",
      name: job.company.name,
      ...(job.company.website && { sameAs: job.company.website }),
      ...(job.company.logoUrl && { logo: abs(job.company.logoUrl) }),
    },
    ...(remote
      ? { jobLocationType: "TELECOMMUTE", ...(country && { applicantLocationRequirements: { "@type": "Country", name: country } }) }
      : {}),
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
