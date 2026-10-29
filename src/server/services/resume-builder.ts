import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { existsSync } from "node:fs";
import { z } from "zod";
import { db } from "@/server/db";
import { makeFormat } from "@/i18n/format";
import type { Locale } from "@/i18n/config";

// The CV builder, shared by the website and the app: the member's CV data (resume_data), filled from their profile
// the first time; and turning it into a PDF. The PDF is drawn by a real browser (Edge or Chrome, already on the
// server, through puppeteer-core) from an HTML page, so Arabic and other scripts come out right.

const text = (max: number) => z.string().trim().max(max);
const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => v || null);
// Dates are kept as the member typed them ("2021", "Mar 2021", "2021-03"), so any format reads naturally.
const when = optional(30);

export const resumeSchema = z.object({
  fullName: text(120).min(1, "@v.resumeName"),
  headline: optional(160),
  email: optional(160),
  phone: optional(40),
  location: optional(120),
  summary: optional(3000),
  experience: z
    .array(z.object({ title: text(120).min(1), company: text(120), location: optional(120), start: when, end: when, current: z.boolean().default(false), description: optional(3000) }))
    .max(30),
  education: z.array(z.object({ school: text(160).min(1), degree: optional(120), field: optional(120), start: when, end: when, description: optional(1500) })).max(20),
  skills: z.array(text(60).min(1)).max(60),
  languages: z.array(z.object({ name: text(60).min(1), level: optional(60) })).max(20),
  links: z.array(z.object({ label: text(60).min(1), url: text(300).min(1) })).max(10),
});
export type ResumeFields = z.infer<typeof resumeSchema>;

const PROFICIENCY: Record<string, string> = { ELEMENTARY: "Elementary", LIMITED: "Limited working", PROFESSIONAL: "Professional", FULL_PROFESSIONAL: "Full professional", NATIVE: "Native" };
const monthYear = (d: Date | null | undefined) => (d ? d.toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" }) : null);

/** A first CV built from the member's profile: name, headline, about, experience, education, skills, languages. */
async function fromProfile(userId: string, locale: Locale): Promise<ResumeFields> {
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      name: true,
      email: true,
      profile: {
        select: {
          headline: true,
          about: true,
          city: true,
          countryCode: true,
          website: true,
          experiences: { orderBy: { startDate: "desc" }, select: { title: true, companyName: true, location: true, startDate: true, endDate: true, isCurrent: true, description: true } },
          educations: { orderBy: { startDate: "desc" }, select: { school: true, degree: true, fieldOfStudy: true, startDate: true, endDate: true, description: true } },
          skills: { orderBy: [{ isTop: "desc" }, { endorsementCount: "desc" }], select: { skill: { select: { name: true } } } },
          languages: { select: { languageCode: true, proficiency: true } },
        },
      },
    },
  });
  const p = user.profile;
  const f = makeFormat(locale);
  return resumeSchema.parse({
    fullName: user.name,
    headline: p?.headline,
    email: user.email,
    phone: null,
    location: p ? f.location(p.city, p.countryCode) || null : null,
    summary: p?.about,
    experience: (p?.experiences ?? []).slice(0, 30).map((e) => ({
      title: e.title.slice(0, 120),
      company: e.companyName.slice(0, 120),
      location: e.location,
      start: monthYear(e.startDate),
      end: e.isCurrent ? null : monthYear(e.endDate),
      current: e.isCurrent,
      description: e.description?.slice(0, 3000),
    })),
    education: (p?.educations ?? []).slice(0, 20).map((e) => ({
      school: e.school.slice(0, 160),
      degree: e.degree,
      field: e.fieldOfStudy,
      start: monthYear(e.startDate),
      end: monthYear(e.endDate),
      description: e.description?.slice(0, 1500),
    })),
    skills: [...new Set((p?.skills ?? []).map((s) => s.skill.name.slice(0, 60)))].slice(0, 60),
    languages: (p?.languages ?? []).slice(0, 20).map((l) => ({ name: f.language(l.languageCode), level: PROFICIENCY[l.proficiency] ?? null })),
    links: p?.website ? [{ label: "Website", url: p.website.slice(0, 300) }] : [],
  });
}

/** The member's CV data: what they saved, or (never saved) a first version from their profile. */
export async function getResume(userId: string, locale: Locale): Promise<{ data: ResumeFields; saved: boolean; updatedAt: Date | null }> {
  const row = await db.resumeData.findUnique({ where: { userId } });
  if (!row) return { data: await fromProfile(userId, locale), saved: false, updatedAt: null };
  const parsed = resumeSchema.safeParse({ ...row, experience: row.experience, education: row.education, languages: row.languages, links: row.links });
  return { data: parsed.success ? parsed.data : await fromProfile(userId, locale), saved: true, updatedAt: row.updatedAt };
}

export async function saveResume(userId: string, d: ResumeFields) {
  const row = await db.resumeData.upsert({ where: { userId }, create: { userId, ...d }, update: d, select: { updatedAt: true } });
  return row.updatedAt;
}

/** Starts again from the profile: forgets the saved CV data. */
export async function resetResume(userId: string) {
  await db.resumeData.deleteMany({ where: { userId } });
}

// ── The CV as HTML, then PDF ────────────────────────────────────────────────

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const safeUrl = (u: string) => {
  const url = /^https?:\/\//i.test(u) ? u : `https://${u}`;
  try {
    return new URL(url).protocol.startsWith("http") ? url : null;
  } catch {
    return null;
  }
};
const range = (start: string | null, end: string | null, current: boolean, present: string) => [start, current ? present : end].filter(Boolean).join(" – ");
const para = (s: string | null) => (s ? `<p class="desc">${esc(s).replace(/\n/g, "<br>")}</p>` : "");

const LABELS = {
  en: { summary: "Profile", experience: "Experience", education: "Education", skills: "Skills", languages: "Languages", present: "Present" },
  ar: { summary: "نبذة", experience: "الخبرة", education: "التعليم", skills: "المهارات", languages: "اللغات", present: "حتى الآن" },
} as const;

/** The CV page (A4, print styles). Everything the member wrote is escaped, so it's shown as text only. */
export function resumeHtml(d: ResumeFields, locale: Locale) {
  const L = LABELS[locale];
  const rtl = locale === "ar";
  // Email and phone always read left to right, even on an Arabic CV.
  const contact = [
    ...[d.email, d.phone].filter(Boolean).map((c) => `<span dir="ltr">${esc(c!)}</span>`),
    ...(d.location ? [`<span>${esc(d.location)}</span>`] : []),
  ];
  const links = d.links.flatMap((l) => {
    const href = safeUrl(l.url);
    return href ? [`<a href="${esc(href)}">${esc(l.label)}</a>`] : [];
  });
  const section = (title: string, body: string) => (body ? `<section><h2>${esc(title)}</h2>${body}</section>` : "");
  return `<!doctype html><html lang="${locale}" dir="${rtl ? "rtl" : "ltr"}"><head><meta charset="utf-8"><title>${esc(d.fullName)}</title><style>
@page { size: A4; margin: 16mm 15mm; }
* { box-sizing: border-box; }
body { margin: 0; font-family: "Segoe UI", "Noto Sans", "Noto Sans Arabic", Tahoma, Arial, sans-serif; color: #1c1b29; font-size: 10.5pt; line-height: 1.5; }
header { border-bottom: 2px solid #6b4ef6; padding-bottom: 10px; margin-bottom: 14px; }
h1 { margin: 0; font-size: 24pt; line-height: 1.15; letter-spacing: -0.01em; }
.headline { margin: 3px 0 0; font-size: 12pt; color: #4b4a5e; }
.contact { margin-top: 8px; display: flex; flex-wrap: wrap; gap: 4px 16px; font-size: 9.5pt; color: #4b4a5e; }
.contact a { color: #5a3fe0; text-decoration: none; }
section { margin-top: 14px; break-inside: auto; }
h2 { margin: 0 0 6px; font-size: 10.5pt; text-transform: uppercase; letter-spacing: 0.08em; color: #5a3fe0; }
.item { margin-bottom: 9px; break-inside: avoid; }
.row { display: flex; justify-content: space-between; gap: 12px; align-items: baseline; }
.title { font-weight: 700; }
.sub { color: #4b4a5e; }
.when { color: #6b6a7e; font-size: 9.5pt; white-space: nowrap; }
.desc { margin: 3px 0 0; color: #33324a; }
.chips { display: flex; flex-wrap: wrap; gap: 5px; }
/* Each piece of text takes its own direction (English words in an Arabic CV, and the other way round). */
p, h1, .title, .sub, .chip, .contact span { unicode-bidi: plaintext; }
.chip { border: 1px solid #d9d4fb; background: #f4f2ff; border-radius: 999px; padding: 1px 9px; font-size: 9.5pt; }
</style></head><body>
<header><h1>${esc(d.fullName)}</h1>${d.headline ? `<p class="headline">${esc(d.headline)}</p>` : ""}
${contact.length || links.length ? `<div class="contact">${[...contact, ...links].join("")}</div>` : ""}</header>
${section(L.summary, para(d.summary))}
${section(
  L.experience,
  d.experience
    .map(
      (e) =>
        `<div class="item"><div class="row"><div><span class="title">${esc(e.title)}</span>${e.company ? ` <span class="sub">· ${esc(e.company)}</span>` : ""}${e.location ? ` <span class="sub">· ${esc(e.location)}</span>` : ""}</div><div class="when">${esc(range(e.start, e.end, e.current, L.present))}</div></div>${para(e.description)}</div>`,
    )
    .join(""),
)}
${section(
  L.education,
  d.education
    .map(
      (e) =>
        `<div class="item"><div class="row"><div><span class="title">${esc(e.school)}</span>${[e.degree, e.field].filter(Boolean).length ? ` <span class="sub">· ${esc([e.degree, e.field].filter(Boolean).join(", "))}</span>` : ""}</div><div class="when">${esc(range(e.start, e.end, false, L.present))}</div></div>${para(e.description)}</div>`,
    )
    .join(""),
)}
${section(L.skills, d.skills.length ? `<div class="chips">${d.skills.map((s) => `<span class="chip">${esc(s)}</span>`).join("")}</div>` : "")}
${section(L.languages, d.languages.length ? `<div class="chips">${d.languages.map((l) => `<span class="chip">${esc(l.name)}${l.level ? ` — ${esc(l.level)}` : ""}</span>`).join("")}</div>` : "")}
</body></html>`;
}

/** The browser that draws PDFs: PDF_BROWSER_PATH, else Chrome or Edge where Windows installs them. */
function browserPath() {
  const candidates = [
    process.env.PDF_BROWSER_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
  ];
  return candidates.find((p): p is string => !!p && existsSync(p)) ?? null;
}

// One browser for the whole server, started on the first PDF and closed after a few idle minutes.
type Browser = Awaited<ReturnType<(typeof import("puppeteer-core"))["launch"]>>;
let browser: Promise<Browser> | null = null;
let idleTimer: ReturnType<typeof setTimeout> | null = null;

async function getBrowser() {
  if (!browser) {
    const executablePath = browserPath();
    if (!executablePath) throw new Error("No browser found for PDFs: set PDF_BROWSER_PATH to Edge or Chrome.");
    const { launch } = await import("puppeteer-core");
    browser = launch({ executablePath, headless: true, args: ["--no-sandbox", "--disable-gpu", "--no-first-run", "--disable-extensions"] });
    browser.then((b) => b.on("disconnected", () => (browser = null))).catch(() => (browser = null));
  }
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    browser?.then((b) => b.close()).catch(() => undefined);
    browser = null;
  }, 5 * 60_000);
  return browser;
}

/** The CV as a PDF file. The page loads nothing from the internet (JavaScript off, every request blocked). */
export async function resumePdf(d: ResumeFields, locale: Locale): Promise<Uint8Array> {
  const page = await (await getBrowser()).newPage();
  try {
    await page.setJavaScriptEnabled(false);
    await page.setRequestInterception(true);
    page.on("request", (r) => (r.url().startsWith("data:") || r.url() === "about:blank" ? r.continue() : r.abort()));
    await page.setContent(resumeHtml(d, locale), { waitUntil: "load", timeout: 15_000 });
    return await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true });
  } finally {
    await page.close().catch(() => undefined);
  }
}

export const resumeFileName = (d: ResumeFields) => `${d.fullName.replace(/[^\p{L}\p{N} _-]/gu, "").trim().replace(/\s+/g, "-") || "CV"}-CV.pdf`;

// ── Signed download links (for the app, which opens the PDF in the phone's browser) ─────────────────

const sign = (userId: string, locale: string, exp: number) =>
  createHmac("sha256", `resume-pdf:${process.env.BETTER_AUTH_SECRET ?? ""}`).update(`${userId}\n${locale}\n${exp}`).digest("base64url");

/** A link to the member's CV PDF that works for 10 minutes without signing in. */
export function resumePdfLink(baseUrl: string, userId: string, locale: Locale) {
  const exp = Math.floor(Date.now() / 1000) + 600;
  return `${baseUrl}/api/v1/resume-pdf/${encodeURIComponent(userId)}?lang=${locale}&exp=${exp}&sig=${sign(userId, locale, exp)}`;
}

export function verifyResumePdfLink(userId: string, locale: string, exp: string | null, sig: string | null) {
  if (!exp || !sig || !/^\d{1,12}$/.test(exp) || Number(exp) * 1000 < Date.now()) return false;
  const expected = Buffer.from(sign(userId, locale, Number(exp)));
  const given = Buffer.from(sig);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
