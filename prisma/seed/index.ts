/**
 * JOBLIO development seed.
 *
 *   npm run db:seed
 *
 * Wipes the database and creates a realistic, deterministic dataset.
 *
 * Demo accounts (development only — every seeded account uses this password):
 *   Job seeker  maya@joblio.dev
 *   Recruiter   omar@joblio.dev   (owner of Aurora Labs, Recruiter Pro)
 *   Password    JoblioDemo!2026
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "better-auth/crypto";
import { PrismaClient } from "../../src/generated/prisma/client";
import type {
  ApplicationStatus,
  Availability,
  EmploymentType,
  ExperienceLevel,
  NotificationType,
  PipelineStage,
  SkillLevel,
  WorkMode,
} from "../../src/generated/prisma/enums";
import { computeMatch } from "../../src/lib/matching/engine";
import { createT } from "../../src/i18n/translate";
import { translateKey } from "../../src/i18n/message";
import { candidateMatchSelect, jobMatchSelect, toCandidateFacts, toJobFacts } from "../../src/lib/matching/prisma-facts";
import { computeYearsExperience, highestEducation } from "../../src/lib/profile-derived";
import { profileCompleteness } from "../../src/lib/profile-completeness";
import { BENEFITS, COMMENTS, COMPANIES, COMPANY_POSTS, INDUSTRIES, PAST_EMPLOYERS, PEOPLE, POSTS, ROLES, SCHOOLS, SKILLS, VALUES } from "./data";

export const DEMO_PASSWORD = "JoblioDemo!2026";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

// ── helpers ───────────────────────────────────────────────────────────────
let seed = 20261007;
const rand = () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = <T,>(arr: readonly T[]) => arr[Math.floor(rand() * arr.length)]!;
const sample = <T,>(arr: readonly T[], n: number) => [...arr].sort(() => rand() - 0.5).slice(0, n);
const int = (min: number, max: number) => Math.floor(min + rand() * (max - min + 1));
const DAY = 86_400_000;
const daysAgo = (d: number) => new Date(Date.now() - d * DAY);
const daysFromNow = (d: number) => new Date(Date.now() + d * DAY);
const monthsAgo = (m: number) => {
  const d = new Date();
  d.setMonth(d.getMonth() - m, 1);
  return d;
};
const slug = (s: string) =>
  s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const FX: Record<string, number> = { USD: 1, EUR: 0.92, GBP: 0.79 };
const COUNTRY_PAY: Record<string, number> = { US: 1.15, CA: 0.9, GB: 0.95, DE: 0.95, NL: 0.95, ES: 0.75, NO: 1, AE: 0.95, SA: 0.9, SG: 1, JP: 0.85, AU: 1, IN: 0.45, BR: 0.55, NG: 0.5, JO: 0.55 };

let invoiceSeq = 1000;

async function main() {
  console.log("→ Resetting database");
  const tables = await db.$queryRawUnsafe<{ tablename: string }[]>(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`,
  );
  await db.$executeRawUnsafe(`TRUNCATE TABLE ${tables.map((t) => `"${t.tablename}"`).join(", ")} CASCADE`);

  const passwordHash = await hashPassword(DEMO_PASSWORD);

  // ── taxonomy ────────────────────────────────────────────────────────────
  console.log("→ Industries & skills");
  const industryIds = new Map<string, string>();
  for (const name of INDUSTRIES) {
    const i = await db.industry.create({ data: { name, slug: slug(name) } });
    industryIds.set(name, i.id);
  }
  const skillIds = new Map<string, string>();
  for (const [category, names] of Object.entries(SKILLS)) {
    for (const name of names) {
      const s = await db.skill.create({ data: { name, slug: slug(name.replace(/\+\+/g, "pp").replace(/#/g, "sharp").replace(/^\./, "dot")), category, aliases: [] } });
      skillIds.set(name, s.id);
    }
  }
  const sid = (name: string) => {
    const id = skillIds.get(name);
    if (!id) throw new Error(`Unknown skill ${name}`);
    return id;
  };

  // ── users ───────────────────────────────────────────────────────────────
  const usernames = new Set<string>();
  async function createUser(name: string, email: string, intent: "SEEKER" | "RECRUITER" | "BOTH", createdDaysAgo = int(60, 700)) {
    const id = randomUUID();
    let username = slug(name).replace(/-/g, ".");
    while (usernames.has(username)) username = `${username}.${int(10, 99)}`;
    usernames.add(username);
    const createdAt = daysAgo(createdDaysAgo);
    await db.user.create({
      data: {
        id,
        name,
        email,
        emailVerified: true,
        username,
        intent,
        onboardedAt: createdAt,
        createdAt,
        lastSeenAt: daysAgo(rand() * 3),
        accounts: { create: { id: randomUUID(), accountId: id, providerId: "credential", password: passwordHash } },
        settings: { create: {} },
      },
    });
    return { id, name, username };
  }

  // ── companies & recruiters ──────────────────────────────────────────────
  console.log("→ Companies");
  const companies: { id: string; seed: (typeof COMPANIES)[number]; recruiterId: string }[] = [];
  for (const [i, c] of COMPANIES.entries()) {
    const email = c.slug === "aurora-labs" ? "omar@joblio.dev" : `${slug(c.recruiter[0]).split("-")[0]}@${c.slug}.example`;
    const recruiter = await createUser(c.recruiter[0], email, c.slug === "aurora-labs" ? "BOTH" : "RECRUITER");
    await db.profile.create({
      data: {
        userId: recruiter.id,
        headline: `${c.recruiter[1]} at ${c.name}`,
        about: `I help ${c.name} find people who love building things. Always happy to chat about open roles and what it's like to work here.`,
        city: c.city,
        countryCode: c.country,
        languages: { create: [{ languageCode: "en", proficiency: "FLUENT" }] },
        skills: {
          create: ["Recruiting", "Talent Acquisition", "Employer Branding", "Communication"].map((n, p) => ({ skillId: sid(n), level: "ADVANCED" as SkillLevel, position: p })),
        },
        experiences: {
          create: [{ title: c.recruiter[1], companyName: c.name, startDate: monthsAgo(int(14, 40)), isCurrent: true, employmentType: "FULL_TIME" }],
        },
      },
    });
    const company = await db.company.create({
      data: {
        slug: c.slug,
        name: c.name,
        tagline: c.tagline,
        about: `${c.name} was founded in ${c.founded} in ${c.city}. ${c.tagline} Today our team works across ${int(3, 12)} countries, serving customers worldwide. We care about thoughtful work, honest communication and giving people room to grow.`,
        industryId: industryIds.get(c.industry),
        size: c.size,
        foundedYear: c.founded,
        city: c.city,
        countryCode: c.country,
        website: `https://${c.slug}.example`,
        brandColor: c.color,
        coverUrl: `/media/cover-${(i % 16) + 1}.svg`,
        benefits: sample(BENEFITS, 6),
        values: sample(VALUES, 4),
        cultureText: `Life at ${c.name} is collaborative and calm. We write things down, ship in small steps, and celebrate the people behind the work. Teams have real autonomy and clear goals, and everyone gets a dedicated learning budget.`,
        verified: !!c.verified,
        premiumUntil: c.premium ? daysFromNow(200) : null,
        members: { create: { userId: recruiter.id, role: "OWNER", title: c.recruiter[1] } },
        media: {
          create: Array.from({ length: c.premium ? 6 : 4 }, (_, k) => ({
            type: "PHOTO" as const,
            url: `/media/life-${((i * 3 + k) % 24) + 1}.svg`,
            caption: pick(["Team offsite", "Our studio", "Friday demos", "Hack week", "Coffee corner", "Planning day", "Community meetup"]),
            position: k,
          })),
        },
      },
    });
    await db.experience.updateMany({ where: { profile: { userId: recruiter.id } }, data: { companyId: company.id } });
    companies.push({ id: company.id, seed: c, recruiterId: recruiter.id });
  }
  const omar = companies.find((c) => c.seed.slug === "aurora-labs")!;

  // ── professionals ───────────────────────────────────────────────────────
  console.log("→ Professionals");
  type Person = { id: string; profileId: string; name: string; role: string };
  const people: Person[] = [];
  const AVAIL: Availability[] = ["IMMEDIATELY", "TWO_WEEKS", "ONE_MONTH", "THREE_MONTHS", "NOT_LOOKING"];
  for (const [idx, [name, roleKey, city, country, years, langs]] of PEOPLE.entries()) {
    const role = ROLES[roleKey]!;
    const user = await createUser(name, `${slug(name)}@people.example`, "SEEKER");
    const seniority = years >= 6 ? 2 : years >= 3 ? 1 : 0;
    const openToWork = rand() < 0.55;
    const roleSkillNames = new Set(role.candidateSkills.map(([n]) => n));
    const extra = sample(SKILLS["Professional skills"]!.filter((n) => !roleSkillNames.has(n)), 3);
    const skillList: [string, SkillLevel][] = [
      ...role.candidateSkills.map(([n, l]) => [n, seniority === 0 && l === "EXPERT" ? "ADVANCED" : seniority === 0 && l === "ADVANCED" ? "INTERMEDIATE" : l] as [string, SkillLevel]),
      ...extra.map((n) => [n, pick(["INTERMEDIATE", "ADVANCED"] as SkillLevel[])] as [string, SkillLevel]),
    ];
    // Build a believable work history ending today.
    const totalMonths = Math.round(years * 12);
    const segments = years > 6 ? 3 : years > 2 ? 2 : 1;
    const experiences = [];
    let cursor = 0;
    for (let s = 0; s < segments; s++) {
      const len = s === segments - 1 ? totalMonths - cursor : Math.round(totalMonths / segments);
      const startM = totalMonths - cursor;
      const endM = startM - len;
      const isCurrent = s === segments - 1;
      const companyMatch = isCurrent && rand() < 0.3 ? pick(companies) : null;
      experiences.push({
        title: role.titles[Math.min(2, s + (seniority === 2 ? 1 : 0))]!,
        companyName: companyMatch?.seed.name ?? pick(PAST_EMPLOYERS),
        companyId: companyMatch?.id ?? null,
        employmentType: "FULL_TIME" as EmploymentType,
        location: `${city}`,
        startDate: monthsAgo(startM),
        endDate: isCurrent ? null : monthsAgo(endM),
        isCurrent,
        description: `${role.summary} ${pick(role.responsibilities)}. ${pick(role.responsibilities)}.`,
      });
      cursor += len;
    }
    const gradYear = new Date().getFullYear() - Math.ceil(years) - 1;
    const boosted = idx % 7 === 0;
    const profile = await db.profile.create({
      data: {
        userId: user.id,
        headline: `${experiences[experiences.length - 1]!.title} · ${role.required.slice(0, 2).join(", ")}`,
        about: `${role.summary} I've spent ${years} years working on this, most recently at ${experiences[experiences.length - 1]!.companyName}. I care about doing work that is useful, well-crafted and easy for others to build on. Outside of work I mentor people early in their careers.`,
        city,
        countryCode: country,
        openToWork,
        availability: openToWork ? pick(AVAIL.slice(0, 4)) : "NOT_LOOKING",
        desiredTitles: [role.titles[Math.min(2, seniority + 1)]!],
        preferredWorkModes: sample(["REMOTE", "HYBRID", "ONSITE"] as WorkMode[], int(1, 2)),
        preferredEmploymentTypes: ["FULL_TIME"],
        openToRelocate: rand() < 0.3,
        desiredSalaryMin: Math.round((role.baseSalary * (0.75 + seniority * 0.2) * (COUNTRY_PAY[country] ?? 0.7)) / 1000) * 1000,
        salaryCurrency: "USD",
        featuredUntil: boosted ? daysFromNow(int(2, 25)) : null,
        preferredIndustries: { connect: sample(INDUSTRIES, 2).map((n) => ({ id: industryIds.get(n)! })) },
        skills: { create: skillList.map(([n, level], p) => ({ skillId: sid(n), level, position: p, isTop: p < 3 })) },
        experiences: { create: experiences },
        educations: {
          create: [
            {
              school: SCHOOLS[country] ?? "Open University",
              degree: role.degree,
              fieldOfStudy: role.field,
              level: role.degree.startsWith("M") ? "MASTER" : "BACHELOR",
              startDate: new Date(gradYear - 4, 8, 1),
              endDate: new Date(gradYear, 5, 30),
            },
          ],
        },
        languages: { create: langs.map((code, k) => ({ languageCode: code, proficiency: k === 0 ? "NATIVE" : pick(["PROFESSIONAL", "FLUENT"] as const) })) },
        projects:
          rand() < 0.7
            ? {
                create: [
                  {
                    title: `${pick(["Open-source", "Internal", "Community", "Side"])} ${pick(["toolkit", "dashboard", "platform", "research study", "campaign", "app"])}`,
                    summary: role.summary,
                    description: `${pick(role.responsibilities)}. Built with ${role.required.join(", ")}.`,
                    imageUrl: `/media/project-${(idx % 12) + 1}.svg`,
                    startDate: monthsAgo(int(6, 30)),
                    skills: { connect: role.required.slice(0, 3).map((n) => ({ id: sid(n) })) },
                  },
                ],
              }
            : undefined,
        socialLinks: rand() < 0.6 ? { create: [{ platform: "website", url: `https://${slug(name)}.example` }] } : undefined,
      },
    });
    people.push({ id: user.id, profileId: profile.id, name, role: roleKey });
  }

  // ── Maya: the showcase job seeker ───────────────────────────────────────
  console.log("→ Demo seeker");
  const maya = await createUser("Maya Chen", "maya@joblio.dev", "SEEKER", 420);
  const fjord = companies.find((c) => c.seed.slug === "fjord-design")!;
  const northwind = companies.find((c) => c.seed.slug === "northwind")!;
  const mayaSkills: [string, SkillLevel][] = [
    ["React", "EXPERT"], ["TypeScript", "ADVANCED"], ["JavaScript", "EXPERT"], ["Next.js", "ADVANCED"], ["CSS", "EXPERT"],
    ["Accessibility", "ADVANCED"], ["Tailwind CSS", "ADVANCED"], ["Testing", "ADVANCED"], ["Design Systems", "ADVANCED"],
    ["Node.js", "INTERMEDIATE"], ["GraphQL", "INTERMEDIATE"], ["Figma", "INTERMEDIATE"], ["Web Performance", "ADVANCED"], ["Git", "ADVANCED"], ["Mentoring", "INTERMEDIATE"],
  ];
  const mayaProfile = await db.profile.create({
    data: {
      userId: maya.id,
      headline: "Senior Frontend Engineer · React, TypeScript & accessible design systems",
      about:
        "I build interfaces that feel effortless — fast, accessible and consistent. Over the last six years I've led frontend work on commerce, fintech and design-tool products, and grown two component libraries from scratch. I love the space where engineering meets design, and I'm happiest on small teams with a high bar for craft. Currently exploring senior and staff roles on remote-first product teams.",
      city: "Lisbon",
      countryCode: "PT",
      website: "https://mayachen.example",
      pronouns: "she/her",
      openToWork: true,
      availability: "TWO_WEEKS",
      desiredTitles: ["Senior Frontend Engineer", "Staff Frontend Engineer"],
      preferredWorkModes: ["REMOTE", "HYBRID"],
      preferredEmploymentTypes: ["FULL_TIME", "CONTRACT"],
      preferredCities: ["lisbon", "berlin"],
      openToRelocate: false,
      desiredSalaryMin: 75000,
      salaryCurrency: "USD",
      portfolioEnabled: true,
      portfolioAccent: "#6a4cf0",
      preferredIndustries: { connect: ["Technology", "Finance", "Education"].map((n) => ({ id: industryIds.get(n)! })) },
      skills: { create: mayaSkills.map(([n, level], p) => ({ skillId: sid(n), level, position: p, isTop: p < 4, years: p < 5 ? int(4, 6) : int(1, 3) })) },
      experiences: {
        create: [
          { title: "Frontend Developer", companyName: "Pixel & Co", employmentType: "FULL_TIME", workMode: "ONSITE", location: "Porto, Portugal", startDate: new Date(2019, 8, 1), endDate: new Date(2021, 5, 30), description: "Built marketing sites and a React storefront for retail clients. Introduced TypeScript and visual regression testing." },
          { title: "Frontend Engineer", companyName: "Northwind", companyId: northwind.id, employmentType: "FULL_TIME", workMode: "REMOTE", location: "Remote", startDate: new Date(2021, 6, 1), endDate: new Date(2023, 9, 31), description: "Led the checkout rebuild in Next.js (−38% time-to-interactive). Created the Orbit component library used by 9 teams." },
          { title: "Senior Frontend Engineer", companyName: "Fjord Design Studio", companyId: fjord.id, employmentType: "FULL_TIME", workMode: "HYBRID", location: "Lisbon, Portugal", startDate: new Date(2023, 10, 1), isCurrent: true, description: "Frontend lead for client product engagements. Own architecture, accessibility audits and mentoring for a team of five." },
        ],
      },
      educations: {
        create: [
          { school: "University of Porto", degree: "BSc", fieldOfStudy: "Computer Science", level: "BACHELOR", startDate: new Date(2015, 8, 1), endDate: new Date(2019, 6, 30), grade: "17/20", description: "Thesis on perceptual performance metrics for web apps." },
        ],
      },
      projects: {
        create: [
          { title: "Orbit UI", summary: "Open-source React component library focused on accessibility.", description: "60+ accessible components, full keyboard support and theming. 2.1k GitHub stars and used in production by several startups.", url: "https://orbit-ui.example", repoUrl: "https://github.com/example/orbit-ui", imageUrl: "/media/project-1.svg", featured: true, position: 0, startDate: new Date(2021, 2, 1), skills: { connect: ["React", "TypeScript", "Accessibility", "Design Systems"].map((n) => ({ id: sid(n) })) } },
          { title: "Lisbon Transit Pulse", summary: "Real-time dashboard of public transit delays.", description: "Weekend project visualising delay data from the city's open API. Featured by the municipal data team.", url: "https://transit.example", imageUrl: "/media/project-2.svg", position: 1, startDate: new Date(2024, 3, 1), skills: { connect: ["Next.js", "Web Performance"].map((n) => ({ id: sid(n) })) } },
          { title: "Accessible Charts Toolkit", summary: "Screen-reader friendly chart primitives.", description: "Chart components that expose data tables and sonification for blind and low-vision users.", repoUrl: "https://github.com/example/a11y-charts", imageUrl: "/media/project-3.svg", position: 2, startDate: new Date(2022, 9, 1), skills: { connect: ["React", "Accessibility"].map((n) => ({ id: sid(n) })) } },
        ],
      },
      certificates: {
        create: [
          { name: "Web Accessibility Specialist (WAS)", issuer: "IAAP", issueDate: new Date(2023, 4, 1), credentialId: "WAS-48213", credentialUrl: "https://iaap.example/verify/WAS-48213" },
          { name: "AWS Certified Cloud Practitioner", issuer: "Amazon Web Services", issueDate: new Date(2022, 1, 1), expiryDate: new Date(2027, 1, 1) },
        ],
      },
      languages: { create: [{ languageCode: "en", proficiency: "FLUENT" }, { languageCode: "pt", proficiency: "PROFESSIONAL" }, { languageCode: "zh", proficiency: "NATIVE" }] },
      socialLinks: { create: [{ platform: "github", url: "https://github.com/example" }, { platform: "website", url: "https://mayachen.example" }, { platform: "dribbble", url: "https://dribbble.com/example" }] },
      portfolioItems: {
        create: [
          { title: "Checkout redesign case study", type: "LINK", url: "https://mayachen.example/checkout", thumbnailUrl: "/media/project-4.svg", description: "How we cut checkout time by a third.", position: 0 },
          { title: "Design system talk — FrontConf 2025", type: "VIDEO", url: "https://mayachen.example/talk", thumbnailUrl: "/media/project-5.svg", description: "Scaling a component library across nine teams.", position: 1 },
        ],
      },
    },
  });
  people.push({ id: maya.id, profileId: mayaProfile.id, name: "Maya Chen", role: "frontend" });

  // ── jobs ────────────────────────────────────────────────────────────────
  console.log("→ Jobs");
  const LEVELS: { level: ExperienceLevel; min: number; factor: number }[] = [
    { level: "ENTRY", min: 0, factor: 0.7 },
    { level: "MID", min: 2, factor: 1 },
    { level: "SENIOR", min: 5, factor: 1.3 },
  ];
  const MODES: WorkMode[] = ["REMOTE", "HYBRID", "ONSITE", "REMOTE", "HYBRID"];
  const jobs: { id: string; companyIdx: number; role: string; level: number; publishedAt: Date }[] = [];
  let jobCounter = 0;
  for (const [ci, c] of companies.entries()) {
    for (const roleKey of c.seed.roles) {
      const role = ROLES[roleKey]!;
      const levels = roleKey === "frontend" ? [1, 2] : [jobCounter % 3 === 0 ? 0 : 1, 2].slice(0, rand() < 0.5 ? 2 : 1);
      for (const li of levels) {
        const L = LEVELS[li]!;
        const mode: WorkMode = roleKey === "frontend" && li === 2 ? "REMOTE" : roleKey === "nurse" || roleKey === "teacher" ? "ONSITE" : MODES[jobCounter % MODES.length]!;
        const pay = role.baseSalary * L.factor * (COUNTRY_PAY[c.seed.country] ?? 0.7);
        const cur = c.seed.currency;
        const min = Math.round((pay * 0.9 * FX[cur]!) / 1000) * 1000;
        const max = Math.round((pay * 1.2 * FX[cur]!) / 1000) * 1000;
        const publishedAt = daysAgo(rand() * 26);
        const featured = ["aurora-labs", "sahara-commerce", "nimbus-cloud"].includes(c.seed.slug) && li === 2;
        const sponsored = (c.seed.slug === "northwind" && roleKey === "fullstack") || (c.seed.slug === "meridian-bank" && roleKey === "frontend" && li === 2);
        const job = await db.job.create({
          data: {
            companyId: c.id,
            postedById: c.recruiterId,
            title: role.titles[li]!,
            summary: role.summary,
            description: `${c.seed.name} is hiring a ${role.titles[li]} to join our ${c.seed.city} team${mode === "REMOTE" ? " (fully remote)" : ""}. ${role.summary} You'll work with a small, senior team that values clear thinking, kind feedback and shipping often.\n\nWe're looking for someone who enjoys ownership and wants to grow with us. If you don't tick every box, we still want to hear from you.`,
            responsibilities: role.responsibilities,
            requirements: [`${L.min > 0 ? `${L.min}+ years of` : "Some"} relevant experience`, ...role.requirements.slice(0, 4)],
            benefits: sample(BENEFITS, 5),
            workMode: mode,
            employmentType: jobCounter % 11 === 5 ? "CONTRACT" : jobCounter % 13 === 7 ? "PART_TIME" : li === 0 && jobCounter % 4 === 0 ? "INTERNSHIP" : "FULL_TIME",
            experienceLevel: L.level,
            minYearsExperience: L.min,
            educationLevel: roleKey === "nurse" || roleKey === "data-engineer" ? "BACHELOR" : jobCounter % 3 === 0 ? "BACHELOR" : "NONE",
            city: mode === "REMOTE" ? null : c.seed.city,
            countryCode: mode === "REMOTE" ? null : c.seed.country,
            salaryMin: jobCounter % 9 === 4 ? null : min,
            salaryMax: jobCounter % 9 === 4 ? null : max,
            salaryCurrency: cur,
            industryId: industryIds.get(c.seed.industry),
            status: "OPEN",
            publishedAt,
            createdAt: publishedAt,
            viewCount: int(40, 900),
            featuredUntil: featured ? daysFromNow(int(5, 20)) : null,
            sponsoredUntil: sponsored ? daysFromNow(int(3, 14)) : null,
            skills: {
              create: [
                ...role.required.map((n) => ({ skillId: sid(n), required: true, minLevel: (li === 2 ? "ADVANCED" : "INTERMEDIATE") as SkillLevel })),
                ...role.preferred.map((n) => ({ skillId: sid(n), required: false, minLevel: "INTERMEDIATE" as SkillLevel })),
              ],
            },
            languages: {
              create: [
                { languageCode: "en", minProficiency: "PROFESSIONAL" },
                ...(roleKey === "sales" && ["AE", "SA", "JO"].includes(c.seed.country) ? [{ languageCode: "ar", minProficiency: "PROFESSIONAL" as const }] : []),
              ],
            },
          },
        });
        jobs.push({ id: job.id, companyIdx: ci, role: roleKey, level: li, publishedAt });
        jobCounter++;
      }
    }
  }
  // A paused and a closed job for Aurora so the dashboard shows every state.
  for (const [title, status] of [["Engineering Manager", "PAUSED"], ["Technical Writer", "CLOSED"]] as const) {
    await db.job.create({
      data: {
        companyId: omar.id, postedById: omar.recruiterId, title, description: `${title} at Aurora Labs.`, responsibilities: [], requirements: [], benefits: [],
        workMode: "HYBRID", employmentType: "FULL_TIME", experienceLevel: "SENIOR", minYearsExperience: 5, city: "Berlin", countryCode: "DE",
        salaryCurrency: "EUR", status, publishedAt: daysAgo(60), industryId: industryIds.get("Technology"),
      },
    });
  }

  // Promotion records + payments behind the featured/sponsored windows.
  const promoted = await db.job.findMany({ where: { OR: [{ featuredUntil: { not: null } }, { sponsoredUntil: { not: null } }] }, select: { id: true, featuredUntil: true, sponsoredUntil: true, postedById: true, companyId: true } });
  for (const j of promoted) {
    const kind = j.featuredUntil ? "FEATURED" : "SPONSORED";
    const endsAt = (j.featuredUntil ?? j.sponsoredUntil)!;
    const payment = await db.payment.create({
      data: {
        userId: j.postedById, companyId: j.companyId, product: kind === "FEATURED" ? "FEATURED_JOB" : "SPONSORED_JOB",
        description: kind === "FEATURED" ? "Featured Job · 30 days" : "Sponsored Job · 14 days", amount: kind === "FEATURED" ? 4900 : 9900,
        status: "SUCCEEDED", invoiceNumber: `JBL-${invoiceSeq++}`, targetId: j.id, paidAt: daysAgo(int(2, 10)),
      },
    });
    await db.jobPromotion.create({ data: { jobId: j.id, kind, startsAt: daysAgo(5), endsAt, paymentId: payment.id } });
  }

  // ── derived profile fields ──────────────────────────────────────────────
  console.log("→ Derived profile data");
  const profiles = await db.profile.findMany({
    select: {
      id: true, headline: true, about: true, city: true, desiredTitles: true, preferredWorkModes: true, user: { select: { image: true } },
      experiences: { select: { startDate: true, endDate: true, isCurrent: true, employmentType: true } },
      educations: { select: { level: true, endDate: true } },
      _count: { select: { skills: true, projects: true, languages: true, socialLinks: true } },
    },
  });
  for (const p of profiles) {
    const { score } = profileCompleteness({
      hasPhoto: !!p.user.image, headline: p.headline, about: p.about, city: p.city, skillCount: p._count.skills, experienceCount: p.experiences.length,
      educationCount: p.educations.length, projectCount: p._count.projects, languageCount: p._count.languages, desiredTitles: p.desiredTitles,
      preferredWorkModes: p.preferredWorkModes, socialLinkCount: p._count.socialLinks,
    });
    await db.profile.update({
      where: { id: p.id },
      data: { yearsExperience: computeYearsExperience(p.experiences), educationLevel: highestEducation(p.educations), completeness: score },
    });
  }

  // ── applications ────────────────────────────────────────────────────────
  console.log("→ Applications & pipeline");
  const STAGE_FOR: Record<ApplicationStatus, PipelineStage> = {
    APPLIED: "APPLIED", VIEWED: "APPLIED", SHORTLISTED: "SCREENING", INTERVIEW: "INTERVIEW", OFFER: "FINAL", HIRED: "HIRED", REJECTED: "SCREENING", WITHDRAWN: "APPLIED",
  };
  const TRACK: ApplicationStatus[] = ["APPLIED", "VIEWED", "SHORTLISTED", "INTERVIEW", "OFFER", "HIRED"];

  async function apply(userId: string, jobId: string, status: ApplicationStatus, createdDaysAgo: number, recruiterId: string) {
    const [profile, job] = await Promise.all([
      db.profile.findUniqueOrThrow({ where: { userId }, select: candidateMatchSelect }),
      db.job.findUniqueOrThrow({ where: { id: jobId }, select: jobMatchSelect }),
    ]);
    const match = computeMatch(toCandidateFacts(profile), toJobFacts(job), "recruiter");
    const createdAt = daysAgo(createdDaysAgo);
    const path = status === "REJECTED" ? (["APPLIED", "VIEWED", "REJECTED"] as ApplicationStatus[]) : TRACK.slice(0, TRACK.indexOf(status) + 1);
    const app = await db.application.create({
      data: {
        jobId, applicantId: userId, status, stage: STAGE_FOR[status], stagePosition: rand() * 1000, matchScore: match.score,
        matchSnapshot: JSON.parse(JSON.stringify(match)),
        coverLetter: "I'd love to bring my experience to your team. The role lines up closely with what I've been doing and where I want to grow next.",
        viewedAt: status === "APPLIED" ? null : new Date(createdAt.getTime() + DAY), rating: status === "APPLIED" ? null : int(3, 5),
        createdAt,
        events: {
          create: path.map((s, k) => ({
            toStatus: s, fromStatus: k === 0 ? null : path[k - 1], toStage: STAGE_FOR[s], actorId: k === 0 ? userId : recruiterId,
            createdAt: new Date(createdAt.getTime() + k * DAY * 1.5),
          })),
        },
      },
    });
    await db.job.update({ where: { id: jobId }, data: { applicationCount: { increment: 1 } } });
    return app;
  }

  const jobsOf = (slugName: string, role?: string) => jobs.filter((j) => companies[j.companyIdx]!.seed.slug === slugName && (!role || j.role === role));
  const auroraSeniorFE = jobsOf("aurora-labs", "frontend").find((j) => j.level === 2)!;
  const mayaApps: [string, ApplicationStatus, number][] = [
    [auroraSeniorFE.id, "INTERVIEW", 9],
    [jobsOf("nimbus-cloud", "frontend")[0]!.id, "SHORTLISTED", 6],
    [jobsOf("meridian-bank", "frontend").find((j) => j.level === 2)!.id, "VIEWED", 4],
    [jobsOf("kumo-games", "frontend")[0]!.id, "APPLIED", 1],
    [jobsOf("pulse-fintech", "frontend")[0]!.id, "REJECTED", 14],
  ];
  for (const [jobId, status, d] of mayaApps) {
    const job = jobs.find((j) => j.id === jobId)!;
    await apply(maya.id, jobId, status, d, companies[job.companyIdx]!.recruiterId);
  }
  // Fill Aurora's pipeline (and other companies) with other candidates.
  const STATUSES: ApplicationStatus[] = ["APPLIED", "APPLIED", "VIEWED", "SHORTLISTED", "INTERVIEW", "OFFER", "HIRED", "REJECTED"];
  for (const job of jobs) {
    const company = companies[job.companyIdx]!;
    const pool = people.filter((p) => p.id !== maya.id && (p.role === job.role || rand() < 0.05));
    const n = company.seed.slug === "aurora-labs" ? Math.min(pool.length, int(4, 7)) : Math.min(pool.length, int(0, 3));
    for (const p of sample(pool, n)) {
      await apply(p.id, job.id, pick(STATUSES), rand() * 20, company.recruiterId);
    }
  }

  // Interview for Maya + a couple on Omar's calendar.
  const mayaAuroraApp = await db.application.findFirstOrThrow({ where: { applicantId: maya.id, jobId: auroraSeniorFE.id } });
  const in3 = daysFromNow(3);
  in3.setHours(15, 0, 0, 0);
  await db.interview.create({
    data: { applicationId: mayaAuroraApp.id, scheduledById: omar.recruiterId, startsAt: in3, durationMinutes: 60, type: "VIDEO", meetingUrl: "https://meet.example/aurora-maya", notes: "Technical deep-dive with two engineers from the platform team.", candidateResponse: "ACCEPTED" },
  });
  const auroraInterviews = await db.application.findMany({ where: { job: { companyId: omar.id }, status: "INTERVIEW", applicantId: { not: maya.id } }, take: 3 });
  for (const [k, a] of auroraInterviews.entries()) {
    const at = daysFromNow(k + 1);
    at.setHours(10 + k * 2, 30, 0, 0);
    await db.interview.create({ data: { applicationId: a.id, scheduledById: omar.recruiterId, startsAt: at, type: k === 1 ? "ONSITE" : "VIDEO", location: k === 1 ? "Aurora Labs, Torstraße 12, Berlin" : null, meetingUrl: k === 1 ? null : "https://meet.example/aurora" } });
  }

  // Job analytics: 14 days of daily stats for Aurora jobs.
  for (const j of jobsOf("aurora-labs")) {
    for (let d = 13; d >= 0; d--) {
      const date = daysAgo(d);
      date.setUTCHours(0, 0, 0, 0);
      await db.jobDailyStat.create({ data: { jobId: j.id, date, views: int(15, 90), applications: int(0, 4), saves: int(0, 6) } });
    }
  }

  // ── network ─────────────────────────────────────────────────────────────
  console.log("→ Network");
  const everyone = [...people, ...companies.map((c) => ({ id: c.recruiterId, name: "", profileId: "", role: "recruiter" }))];
  const pairs = new Set<string>();
  async function connect(a: string, b: string, status: "ACCEPTED" | "PENDING" = "ACCEPTED", createdDaysAgo = rand() * 200) {
    const key = [a, b].sort().join(":");
    if (a === b || pairs.has(key)) return;
    pairs.add(key);
    await db.connection.create({ data: { requesterId: a, addresseeId: b, status, createdAt: daysAgo(createdDaysAgo), respondedAt: status === "ACCEPTED" ? daysAgo(createdDaysAgo - 0.5) : null, message: status === "PENDING" ? "Hi! I enjoyed your recent post — would love to connect." : null } });
  }
  const others = people.filter((p) => p.id !== maya.id);
  for (const p of sample(others, 18)) await connect(p.id, maya.id);
  await connect(omar.recruiterId, maya.id);
  const pendingIn = sample(others.filter((p) => !pairs.has([p.id, maya.id].sort().join(":"))), 3);
  for (const p of pendingIn) await connect(p.id, maya.id, "PENDING", rand() * 3);
  for (const p of others) for (const q of sample(everyone, int(2, 6))) await connect(p.id, q.id);

  // Company follows
  for (const c of sample(companies, 6)) await db.companyFollower.create({ data: { userId: maya.id, companyId: c.id } });
  for (const p of others) for (const c of sample(companies, int(1, 4))) await db.companyFollower.create({ data: { userId: p.id, companyId: c.id } }).catch(() => {});
  for (const c of companies) {
    const n = await db.companyFollower.count({ where: { companyId: c.id } });
    await db.company.update({ where: { id: c.id }, data: { followerCount: n * int(20, 140) } });
  }

  // Endorsements for Maya
  const mayaUserSkills = await db.userSkill.findMany({ where: { profileId: mayaProfile.id }, include: { skill: true } });
  const endorsers = sample(others, 9);
  for (const us of mayaUserSkills) {
    const n = { React: 8, JavaScript: 6, TypeScript: 5, Accessibility: 4, CSS: 3, "Next.js": 3 }[us.skill.name as string] ?? int(0, 2);
    for (const e of endorsers.slice(0, n)) await db.endorsement.create({ data: { userSkillId: us.id, endorserId: e.id } });
    await db.userSkill.update({ where: { id: us.id }, data: { endorsementCount: n } });
  }
  // A few endorsements across the network
  const someSkills = await db.userSkill.findMany({ where: { profileId: { not: mayaProfile.id } }, take: 120 });
  for (const us of sample(someSkills, 60)) {
    const e = pick(others);
    await db.endorsement.create({ data: { userSkillId: us.id, endorserId: e.id } }).catch(() => {});
  }
  const counts = await db.endorsement.groupBy({ by: ["userSkillId"], _count: true });
  for (const c of counts) await db.userSkill.update({ where: { id: c.userSkillId }, data: { endorsementCount: c._count } });

  // ── feed ────────────────────────────────────────────────────────────────
  console.log("→ Feed");
  const postIds: string[] = [];
  for (const [k, p] of POSTS.entries()) {
    const author = k === 2 ? maya : pick(others);
    const post = await db.post.create({ data: { authorId: author.id, type: p.type, content: p.content, createdAt: daysAgo(k * 0.7 + rand()) } });
    postIds.push(post.id);
  }
  for (const [k, content] of COMPANY_POSTS.entries()) {
    const c = companies[k * 3]!;
    const post = await db.post.create({ data: { authorId: c.recruiterId, companyId: c.id, content, mediaUrls: [`/media/life-${k + 5}.svg`], createdAt: daysAgo(k * 1.3 + 0.4) } });
    postIds.push(post.id);
  }
  const shareJob = await db.post.create({
    data: { authorId: omar.recruiterId, companyId: omar.id, type: "JOB", jobId: auroraSeniorFE.id, content: "We're hiring a Senior Frontend Engineer to help shape the next version of our developer tools. Remote-friendly, small senior team, real ownership. 👇", createdAt: daysAgo(0.3) },
  });
  postIds.push(shareJob.id);
  for (const id of postIds) {
    const likers = sample([...others, { id: maya.id }], int(3, 24));
    for (const l of likers) await db.postLike.create({ data: { postId: id, userId: l.id } });
    const commenters = sample(others, int(0, 4));
    for (const c of commenters) await db.comment.create({ data: { postId: id, authorId: c.id, content: pick(COMMENTS), createdAt: daysAgo(rand()) } });
    await db.post.update({ where: { id }, data: { likeCount: likers.length, commentCount: commenters.length, shareCount: int(0, 6) } });
  }

  // ── messages ────────────────────────────────────────────────────────────
  console.log("→ Messages");
  async function conversation(a: string, b: string, lines: [0 | 1, string, number][]) {
    const directKey = [a, b].sort().join(":");
    const lastAt = daysAgo(lines[lines.length - 1]![2]);
    const conv = await db.conversation.create({
      data: { directKey, lastMessageAt: lastAt, participants: { create: [{ userId: a, lastReadAt: lastAt }, { userId: b, lastReadAt: daysAgo(lines[lines.length - 1]![2] + 1) }] } },
    });
    for (const [who, body, d] of lines) await db.message.create({ data: { conversationId: conv.id, senderId: who === 0 ? a : b, body, createdAt: daysAgo(d) } });
    return conv;
  }
  const lina = people.find((p) => p.name === "Lina Haddad")!;
  const tom = people.find((p) => p.name === "Tom Becker")!;
  await conversation(omar.recruiterId, maya.id, [
    [0, "Hi Maya — thanks for applying to the Senior Frontend Engineer role. Your Orbit UI work is exactly the kind of thing our team cares about.", 8],
    [1, "Thank you Omar! I've been following Aurora's developer tools for a while, so this one is exciting for me.", 7.9],
    [0, "Great to hear. We'd love to move you to a technical interview. I've sent an invite for Thursday at 15:00 Lisbon time — does that work?", 2],
    [1, "Thursday works perfectly. Anything I should prepare?", 1.9],
    [0, "Nothing formal. We'll talk through a recent project in depth and pair on a small component. Bring questions!", 0.2],
  ]);
  await conversation(lina.id, maya.id, [
    [0, "Loved your talk on design systems! Would you be up for a coffee chat about component APIs sometime?", 3],
    [1, "Absolutely — I'm free most afternoons next week.", 2.8],
    [0, "Perfect, I'll send a few times. Also sharing a role I think you'd like 👀", 0.5],
  ]);
  await conversation(tom.id, maya.id, [[0, "Hey! Fellow Lisbon frontend dev here — are you going to the meetup on Thursday?", 5], [1, "I am! See you there.", 4.8]]);

  // ── notifications, views, saved jobs, billing ───────────────────────────
  console.log("→ Activity");
  const nimbusApp = await db.application.findFirstOrThrow({ where: { applicantId: maya.id, status: "SHORTLISTED" }, include: { job: { include: { company: true } } } });
  // Notifications are stored as translation keys + variables (rendered in each
  // reader's language), with an English copy in `title`/`body`.
  const en = createT("en");
  type Note = { type: NotificationType; key: string; vars?: Record<string, string | number>; bodyKey?: string; body?: string; href: string; d: number; actorId?: string; read?: boolean };
  const notes: Note[] = [
    { type: "INTERVIEW_INVITATION", key: "notif.interviewInvite", vars: { company: "Aurora Labs" }, body: "Senior Frontend Engineer", href: "/interviews", d: 2, actorId: omar.recruiterId },
    { type: "APPLICATION_UPDATE", key: "notif.appShortlisted", vars: { job: nimbusApp.job.title }, body: nimbusApp.job.company.name, href: "/applications", d: 1 },
    { type: "CONNECTION_REQUEST", key: "notif.connectionRequest", vars: { name: pendingIn[0]!.name }, href: "/network", d: 0.5, actorId: pendingIn[0]!.id },
    { type: "SKILL_ENDORSEMENT", key: "notif.endorsement", vars: { name: endorsers[0]!.name, skill: "React" }, href: `/in/${maya.username}`, d: 3, actorId: endorsers[0]!.id, read: true },
    { type: "PROFILE_VIEW", key: "notif.profileViewRecruiter", vars: { company: "Nimbus Cloud" }, href: "/profile/views", d: 1.5 },
    { type: "POST_LIKE", key: "notif.postLike", vars: { name: lina.name }, href: "/feed", d: 2.5, actorId: lina.id, read: true },
    { type: "NEW_JOB_FROM_FOLLOWED_COMPANY", key: "notif.newJob", vars: { company: "Aurora Labs", job: "Senior Frontend Engineer" }, href: `/jobs/${auroraSeniorFE.id}`, d: 9, read: true },
    { type: "ACHIEVEMENT_UNLOCKED", key: "notif.achievement", vars: { title: "@achievementsDef.TOP_SKILL.title" }, bodyKey: "achievementsDef.TOP_SKILL.description", href: "/profile/achievements", d: 4, read: true },
  ];
  for (const n of notes) {
    await db.notification.create({
      data: {
        userId: maya.id,
        type: n.type,
        titleKey: n.key,
        bodyKey: n.bodyKey ?? null,
        vars: n.vars,
        title: translateKey(en, n.key, n.vars),
        body: n.bodyKey ? en(n.bodyKey) : n.body,
        href: n.href,
        actorId: n.actorId,
        createdAt: daysAgo(n.d),
        readAt: n.read ? daysAgo(n.d - 0.1) : null,
      },
    });
  }
  const omarApps = await db.application.findMany({ where: { job: { companyId: omar.id } }, orderBy: { createdAt: "desc" }, take: 4, include: { applicant: true, job: true } });
  for (const a of omarApps) {
    const vars = { name: a.applicant.name, job: a.job.title, score: a.matchScore };
    await db.notification.create({
      data: {
        userId: omar.recruiterId,
        actorId: a.applicantId,
        type: "NEW_APPLICANT",
        titleKey: "notif.newApplicant",
        bodyKey: "notif.newApplicantBody",
        vars,
        title: en("notif.newApplicant", vars),
        body: en("notif.newApplicantBody", vars),
        href: `/recruiter/jobs/${a.jobId}/pipeline?a=${a.id}`,
        createdAt: a.createdAt,
      },
    });
  }

  for (let k = 0; k < 34; k++) {
    const viewer = pick([...others, ...companies.map((c) => ({ id: c.recruiterId }))]);
    await db.profileView.create({ data: { viewerId: viewer.id, viewedId: maya.id, createdAt: daysAgo(rand() * 29), anonymous: rand() < 0.15 } });
  }
  await db.profile.update({ where: { id: mayaProfile.id }, data: { profileViewCount: 212 } });
  for (const p of others) await db.profile.update({ where: { id: p.profileId }, data: { profileViewCount: int(5, 300) } });

  const appliedIds = new Set(mayaApps.map((a) => a[0]));
  for (const j of sample(jobs.filter((j) => !appliedIds.has(j.id)), 10)) {
    await db.savedJob.create({ data: { userId: maya.id, jobId: j.id, createdAt: daysAgo(rand() * 10) } });
    await db.job.update({ where: { id: j.id }, data: { saveCount: { increment: 1 } } });
  }
  await db.savedSearch.create({ data: { userId: maya.id, kind: "JOB", name: "Remote senior frontend", params: { q: "frontend", mode: ["REMOTE"], level: ["SENIOR"] }, alertsEnabled: true } });
  await db.savedSearch.create({ data: { userId: omar.recruiterId, kind: "CANDIDATE", name: "React engineers in Europe", params: { skills: ["react"], minYears: 3 } } });
  for (const p of sample(others.filter((p) => p.role === "frontend" || p.role === "fullstack"), 4)) {
    await db.savedCandidate.create({ data: { recruiterId: omar.recruiterId, candidateId: p.id, note: "Strong portfolio — reach out for the next frontend opening." } });
  }

  // Billing history
  await db.payment.create({ data: { userId: maya.id, product: "CAREER_BOOST_7", description: "Career Boost · 7 days", amount: 299, status: "SUCCEEDED", invoiceNumber: `JBL-${invoiceSeq++}`, paidAt: daysAgo(48), createdAt: daysAgo(48) } });
  const portfolioPay = await db.payment.create({ data: { userId: maya.id, product: "PREMIUM_PORTFOLIO", description: "Premium Portfolio · monthly", amount: 499, status: "SUCCEEDED", invoiceNumber: `JBL-${invoiceSeq++}`, paidAt: daysAgo(12), createdAt: daysAgo(12) } });
  await db.subscription.create({ data: { userId: maya.id, product: "PREMIUM_PORTFOLIO", status: "ACTIVE", currentPeriodEnd: daysFromNow(18), createdAt: portfolioPay.createdAt } });
  await db.payment.create({ data: { userId: omar.recruiterId, companyId: omar.id, product: "RECRUITER_PRO", description: "Recruiter Pro · monthly", amount: 4900, status: "SUCCEEDED", invoiceNumber: `JBL-${invoiceSeq++}`, paidAt: daysAgo(9), createdAt: daysAgo(9) } });
  await db.subscription.create({ data: { userId: omar.recruiterId, companyId: omar.id, product: "RECRUITER_PRO", status: "ACTIVE", currentPeriodEnd: daysFromNow(21) } });
  await db.subscription.create({ data: { userId: omar.recruiterId, companyId: omar.id, product: "COMPANY_PREMIUM", status: "ACTIVE", currentPeriodEnd: daysFromNow(200) } });

  // ── achievements (same rules as src/lib/achievements.ts) ────────────────
  console.log("→ Achievements");
  const all = await db.user.findMany({ select: { id: true, emailVerified: true, profile: { select: { completeness: true } } } });
  for (const u of all) {
    const codes: string[] = [];
    const completeness = u.profile?.completeness ?? 0;
    if (completeness >= 100) codes.push("PROFILE_COMPLETE");
    if (u.emailVerified && completeness >= 80) codes.push("VERIFIED_PROFESSIONAL");
    if ((await db.userSkill.count({ where: { profile: { userId: u.id }, endorsementCount: { gte: 5 } } })) > 0) codes.push("TOP_SKILL");
    if ((await db.profileView.count({ where: { viewedId: u.id, createdAt: { gte: daysAgo(30) } } })) >= 25) codes.push("RISING_TALENT");
    if ((await db.application.count({ where: { applicantId: u.id, status: { in: ["SHORTLISTED", "INTERVIEW", "OFFER", "HIRED"] } } })) > 0) codes.push("TOP_CANDIDATE");
    const apps = await db.application.findMany({ where: { applicantId: u.id }, select: { createdAt: true, job: { select: { publishedAt: true } } } });
    if (apps.some((a) => a.job.publishedAt && a.createdAt.getTime() - a.job.publishedAt.getTime() < DAY && a.createdAt >= a.job.publishedAt)) codes.push("FAST_APPLICANT");
    if ((await db.savedJob.count({ where: { userId: u.id } })) >= 10 || (await db.companyFollower.count({ where: { userId: u.id } })) >= 5) codes.push("CAREER_EXPLORER");
    if ((await db.connection.count({ where: { status: "ACCEPTED", OR: [{ requesterId: u.id }, { addresseeId: u.id }] } })) >= 25) codes.push("NETWORK_BUILDER");
    if (codes.length) await db.userAchievement.createMany({ data: codes.map((code) => ({ userId: u.id, code, awardedAt: daysAgo(rand() * 30) })) });
  }

  // Skill popularity for autocomplete ranking
  const usage = await db.$queryRawUnsafe<{ id: string; n: bigint }[]>(
    `SELECT s.id, (SELECT COUNT(*) FROM user_skills us WHERE us."skillId" = s.id) + (SELECT COUNT(*) FROM job_skills js WHERE js."skillId" = s.id) AS n FROM skills s`,
  );
  for (const u of usage) await db.skill.update({ where: { id: u.id }, data: { usageCount: Number(u.n) } });

  const summary = {
    users: await db.user.count(), companies: await db.company.count(), jobs: await db.job.count(), applications: await db.application.count(),
    connections: await db.connection.count(), posts: await db.post.count(), skills: await db.skill.count(),
  };
  console.log("✓ Seed complete", summary);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
