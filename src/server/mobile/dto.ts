import "server-only";
import type { MatchResult } from "@/lib/matching/engine";
import type { JobCardWithMatch, JobDetail } from "@/server/services/jobs";
import type { Prisma } from "@/server/db";
import type { companyCardSelect } from "@/server/services/companies";

// What the mobile API returns. Every field is listed explicitly, so a new database column never leaks into the app
// by accident. No emails, no internal ids of other members beyond what the website already shows publicly.

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);
const active = (until: Date | null | undefined, now: number) => !!until && until.getTime() > now;

function toMatch(m: MatchResult | null | undefined) {
  if (!m) return null;
  return { score: m.score, matchedSkills: m.matchedSkills, missingSkills: m.missingSkills };
}

export function toJobCard(j: JobCardWithMatch, now = Date.now()) {
  return {
    id: j.id,
    title: j.title,
    summary: j.summary,
    company: { slug: j.company.slug, name: j.company.name, logoUrl: j.company.logoUrl, verified: j.company.verified, brandColor: j.company.brandColor },
    workMode: j.workMode,
    employmentType: j.employmentType,
    experienceLevel: j.experienceLevel,
    city: j.city,
    countryCode: j.countryCode,
    salary: j.salaryMin != null || j.salaryMax != null ? { min: j.salaryMin, max: j.salaryMax, currency: j.salaryCurrency, period: j.salaryPeriod } : null,
    skills: j.skills.map((s) => ({ name: s.skill.name, slug: s.skill.slug, required: s.required })),
    publishedAt: iso(j.publishedAt),
    applicationCount: j.applicationCount,
    featured: active(j.featuredUntil, now),
    urgent: active(j.urgentUntil, now),
    sponsored: active(j.sponsoredUntil, now),
    // Only when a member is signed in:
    match: toMatch(j.match),
    saved: j.saved ?? null,
    applied: j.applied ?? null,
  };
}

export function toJobDetail(
  j: JobDetail,
  viewer: { match: MatchResult | null; saved: boolean; applied: boolean } | null,
  now = Date.now(),
) {
  return {
    ...toJobCard({ ...j, match: viewer?.match ?? undefined, saved: viewer?.saved, applied: viewer?.applied }, now),
    status: j.status,
    description: j.description,
    responsibilities: j.responsibilities,
    requirements: j.requirements,
    benefits: j.benefits,
    minYearsExperience: j.minYearsExperience,
    educationLevel: j.educationLevel,
    languages: j.languages.map((l) => ({ code: l.languageCode, minProficiency: l.minProficiency })),
    closesAt: iso(j.closesAt),
    viewCount: j.viewCount,
    // Imported listings are applied to on the original site (its terms require the link and the attribution).
    external: j.externalSource && j.externalUrl ? { source: j.externalSource, url: j.externalUrl } : null,
    company: {
      slug: j.company.slug,
      name: j.company.name,
      logoUrl: j.company.logoUrl,
      verified: j.company.verified,
      brandColor: j.company.brandColor,
      tagline: j.company.tagline,
      about: j.company.about,
      size: j.company.size,
      industry: j.company.industry?.name ?? null,
      city: j.company.city,
      countryCode: j.company.countryCode,
      website: j.company.website,
      followerCount: j.company.followerCount,
      openJobs: j.company._count.jobs,
    },
    postedBy: { name: j.postedBy.name, username: j.postedBy.username, image: j.postedBy.image, headline: j.postedBy.profile?.headline ?? null },
  };
}

type CompanyCard = Prisma.CompanyGetPayload<{ select: typeof companyCardSelect }>;

export function toCompanyCard(c: CompanyCard, following: boolean | null, now = Date.now()) {
  return {
    slug: c.slug,
    name: c.name,
    tagline: c.tagline,
    logoUrl: c.logoUrl,
    coverUrl: c.coverUrl,
    brandColor: c.brandColor,
    verified: c.verified,
    premium: active(c.premiumUntil, now),
    size: c.size,
    industry: c.industry ? { name: c.industry.name, slug: c.industry.slug } : null,
    city: c.city,
    countryCode: c.countryCode,
    followerCount: c.followerCount,
    openJobs: c._count.jobs,
    following,
  };
}

/** The signed-in member's own account. Their own email is fine to return; nothing else private is. */
export function toMe(u: { id: string; name: string; email: string; image?: string | null; username?: string | null; intent?: string | null; onboardedAt?: Date | null; emailVerified: boolean }) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    emailVerified: u.emailVerified,
    image: u.image ?? null,
    username: u.username ?? null,
    intent: u.intent ?? null,
    onboarded: !!u.onboardedAt,
  };
}
