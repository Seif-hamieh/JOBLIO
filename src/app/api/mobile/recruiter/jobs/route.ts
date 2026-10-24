import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { jobSchema } from "@/lib/validation/job";
import { LIMITS, rateLimit } from "@/server/rate-limit";
import { refreshSitemap } from "@/server/sitemap";
import { recruiterDashboard } from "@/server/services/recruiter";
import { createJobForCompany } from "@/server/services/job-posting";
import { getMobileSession, mobileError } from "@/server/mobile/auth";

export const dynamic = "force-dynamic";

/** The signed-in member's company id (the website uses their first membership too), or a ready error response. */
async function recruiter(req: Request) {
  const session = await getMobileSession(req);
  if (!session) return { error: mobileError(401, "UNAUTHORIZED", "Sign in first.") };
  const m = await db.companyMember.findFirst({ where: { userId: session.user.id }, orderBy: { createdAt: "asc" }, select: { companyId: true } });
  if (!m) return { error: mobileError(403, "NO_COMPANY", "Create your company first.") };
  return { userId: session.user.id, companyId: m.companyId };
}

const iso = (d: Date | null) => (d ? d.toISOString() : null);

// GET /api/mobile/recruiter/jobs  →  { jobs, pipeline, newApplicants7d }
// The company's jobs (all statuses) with views and applicants, plus how many candidates sit in each stage.
export async function GET(req: Request) {
  const r = await recruiter(req);
  if ("error" in r) return r.error;
  const d = await recruiterDashboard(r.companyId);
  return NextResponse.json(
    {
      jobs: d.jobs.map((j) => ({
        id: j.id,
        title: j.title,
        status: j.status,
        workMode: j.workMode,
        city: j.city,
        publishedAt: iso(j.publishedAt),
        viewCount: j.viewCount,
        applicationCount: j.applicationCount,
        newApplicants: j._count.applications,
      })),
      pipeline: d.byStage,
      newApplicants7d: d.newApplicants,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

// POST /api/mobile/recruiter/jobs  →  201 { job: { id, status } }
// Body: the website's job form fields (title, description, workMode, employmentType, experienceLevel, skills, …).
// Optional website fields the app's short form leaves out get the website form's defaults. `skills` may be plain
// skill ids. Same validation, same rate limit and same follower notifications as posting on the website.
export async function POST(req: Request) {
  const r = await recruiter(req);
  if ("error" in r) return r.error;
  const limit = rateLimit(`${LIMITS.write.key}:${r.userId}`, LIMITS.write.max, LIMITS.write.windowMs);
  if (!limit.ok) return mobileError(429, "RATE_LIMITED", `Too many requests. Try again in ${limit.retryAfterSeconds} s.`);

  const input = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!input || typeof input !== "object") return mobileError(400, "INVALID_BODY", "Send the job as JSON.");
  const skills = Array.isArray(input.skills)
    ? input.skills.map((s) => (typeof s === "string" ? { skillId: s, required: true, minLevel: "INTERMEDIATE" } : s))
    : input.skills;
  const parsed = jobSchema.safeParse({
    minYearsExperience: 0,
    educationLevel: "NONE",
    salaryCurrency: "USD",
    salaryPeriod: "YEAR",
    closesAt: null,
    languages: [],
    publish: true,
    ...input,
    skills,
  });
  if (!parsed.success) {
    const fields = [...new Set(parsed.error.issues.map((i) => String(i.path[0] ?? "body")))];
    return NextResponse.json({ error: { code: "INVALID_FIELDS", message: "Check the highlighted fields.", fields } }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  const job = await createJobForCompany({ userId: r.userId, companyId: r.companyId }, parsed.data);
  revalidatePath("/recruiter");
  refreshSitemap();
  return NextResponse.json({ job: { id: job.id, status: job.status } }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
