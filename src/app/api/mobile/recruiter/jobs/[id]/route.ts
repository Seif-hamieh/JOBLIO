import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { deleteJobForCompany, updateJobForCompany } from "@/server/services/job-editing";
import { getMobileRecruiter, mobileError } from "@/server/mobile/auth";
import { invalidFields, recruiterChange } from "@/server/mobile/recruiter";
import { jobSchema } from "@/lib/validation/job";

export const dynamic = "force-dynamic";

// GET /api/mobile/recruiter/jobs/:id  →  { job }
// Everything the website's job form holds, to edit a job your company posted (skills with their names).
export async function GET(req: Request, { params }: RouteContext<"/api/mobile/recruiter/jobs/[id]">) {
  const r = await getMobileRecruiter(req);
  if ("error" in r) return r.error;
  const { id } = await params;
  const job = await db.job.findFirst({
    where: { id: id.slice(0, 40), companyId: r.companyId },
    select: {
      id: true,
      status: true,
      title: true,
      summary: true,
      description: true,
      responsibilities: true,
      requirements: true,
      benefits: true,
      workMode: true,
      employmentType: true,
      experienceLevel: true,
      minYearsExperience: true,
      educationLevel: true,
      city: true,
      countryCode: true,
      salaryMin: true,
      salaryMax: true,
      salaryCurrency: true,
      salaryPeriod: true,
      industryId: true,
      closesAt: true,
      applicationCount: true,
      skills: { select: { required: true, minLevel: true, skill: { select: { id: true, name: true } } } },
      languages: { select: { languageCode: true, minProficiency: true } },
    },
  });
  if (!job) return mobileError(404, "NOT_FOUND", "This job doesn't exist.");
  const { skills, closesAt, ...rest } = job;
  return NextResponse.json(
    {
      job: {
        ...rest,
        closesAt: closesAt ? closesAt.toISOString().slice(0, 10) : null,
        skills: skills.map((s) => ({ skillId: s.skill.id, name: s.skill.name, required: s.required, minLevel: s.minLevel })),
      },
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

// PUT /api/mobile/recruiter/jobs/:id  (the whole job form, as GET returns it)  →  { message }
// Saves the job with the website's rules (skills and languages are replaced). publish: true on a draft publishes it.
export async function PUT(req: Request, { params }: RouteContext<"/api/mobile/recruiter/jobs/[id]">) {
  const input = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!input || typeof input !== "object") return mobileError(400, "INVALID_BODY", "Send the job as JSON.");
  const parsed = jobSchema.safeParse({ publish: false, ...input });
  if (!parsed.success) return invalidFields(parsed.error.issues);
  const { id } = await params;
  return recruiterChange(req, (r) => updateJobForCompany(r, id.slice(0, 40), parsed.data));
}

// DELETE /api/mobile/recruiter/jobs/:id  →  { message }
// Deletes the job — or closes it instead when people applied, so their history stays (as on the website).
export async function DELETE(req: Request, { params }: RouteContext<"/api/mobile/recruiter/jobs/[id]">) {
  const { id } = await params;
  return recruiterChange(req, (r) => deleteJobForCompany(r, id.slice(0, 40)));
}
