import "server-only";
import type { FullProfile } from "@/server/services/profile-page";
import { ACHIEVEMENTS, type AchievementCode } from "@/lib/achievements";

// A member's profile as the mobile API returns it (explicit fields, as in dto.ts). Used for other members' pages
// and for "my profile" while editing. Dates are ISO strings; images are site paths (the app adds the domain).

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

export function toProfile(u: FullProfile) {
  const p = u.profile!;
  const membership = u.companyMemberships[0];
  return {
    id: u.id,
    name: u.name,
    image: u.image,
    username: u.username,
    joinedAt: iso(u.createdAt),
    verified: !!u.emailVerified,
    headline: p.headline,
    about: p.about,
    coverUrl: p.coverUrl,
    city: p.city,
    countryCode: p.countryCode,
    website: p.website,
    pronouns: p.pronouns,
    openToWork: p.openToWork,
    availability: p.availability,
    yearsExperience: p.yearsExperience,
    desiredTitles: p.desiredTitles,
    profileViews: p.profileViewCount,
    completeness: p.completeness,
    visibility: p.visibility,
    company: membership ? { name: membership.company.name, slug: membership.company.slug, logoUrl: membership.company.logoUrl, title: membership.title } : null,
    skills: p.skills.map((s) => ({ id: s.id, skillId: s.skill.id, name: s.skill.name, level: s.level, years: s.years, isTop: s.isTop, endorsements: s.endorsementCount })),
    experiences: p.experiences.map((e) => ({
      id: e.id,
      title: e.title,
      companyName: e.companyName,
      company: e.company ? { slug: e.company.slug, logoUrl: e.company.logoUrl, brandColor: e.company.brandColor } : null,
      employmentType: e.employmentType,
      workMode: e.workMode,
      location: e.location,
      startDate: iso(e.startDate),
      endDate: iso(e.endDate),
      isCurrent: e.isCurrent,
      description: e.description,
    })),
    educations: p.educations.map((e) => ({
      id: e.id,
      school: e.school,
      degree: e.degree,
      fieldOfStudy: e.fieldOfStudy,
      level: e.level,
      startDate: iso(e.startDate),
      endDate: iso(e.endDate),
      grade: e.grade,
      description: e.description,
    })),
    certificates: p.certificates.map((c) => ({
      id: c.id,
      name: c.name,
      issuer: c.issuer,
      issueDate: iso(c.issueDate),
      expiryDate: iso(c.expiryDate),
      credentialId: c.credentialId,
      credentialUrl: c.credentialUrl,
    })),
    projects: p.projects.map((pr) => ({
      id: pr.id,
      title: pr.title,
      summary: pr.summary,
      description: pr.description,
      url: pr.url,
      repoUrl: pr.repoUrl,
      imageUrl: pr.imageUrl,
      startDate: iso(pr.startDate),
      endDate: iso(pr.endDate),
      featured: pr.featured,
      skills: pr.skills.map((s) => ({ id: s.id, name: s.name })),
    })),
    languages: p.languages.map((l) => ({ code: l.languageCode, proficiency: l.proficiency })),
    links: p.socialLinks.map((l) => ({ platform: l.platform, url: l.url })),
    achievements: u.achievements
      .filter((a) => a.code in ACHIEVEMENTS)
      .map((a) => ({ code: a.code, title: ACHIEVEMENTS[a.code as AchievementCode].title, description: ACHIEVEMENTS[a.code as AchievementCode].description, awardedAt: iso(a.awardedAt) })),
  };
}

/** Every achievement with whether (and when) the member earned it — for their own Achievements screen. */
export function allAchievements(earned: { code: string; awardedAt: Date }[]) {
  const map = new Map(earned.map((e) => [e.code, e.awardedAt]));
  return (Object.keys(ACHIEVEMENTS) as AchievementCode[]).map((code) => ({
    code,
    title: ACHIEVEMENTS[code].title,
    description: ACHIEVEMENTS[code].description,
    rule: ACHIEVEMENTS[code].rule,
    awardedAt: iso(map.get(code)),
  }));
}
