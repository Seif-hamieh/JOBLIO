import { NextResponse } from "next/server";
import { getPipeline } from "@/server/services/recruiter";
import { getMobileRecruiter, mobileError } from "@/server/mobile/auth";

export const dynamic = "force-dynamic";

// GET /api/mobile/recruiter/jobs/:id/pipeline  →  { job, applicants }
// Everyone who applied to one of the company's jobs (withdrawn applications left out), in board order. Same data
// as the website's pipeline board; the app groups them by stage (and shows declined candidates separately).
export async function GET(req: Request, { params }: RouteContext<"/api/mobile/recruiter/jobs/[id]/pipeline">) {
  const r = await getMobileRecruiter(req);
  if ("error" in r) return r.error;
  const { id } = await params;
  const data = await getPipeline(id.slice(0, 40), r.companyId);
  if (!data) return mobileError(404, "NOT_FOUND", "This job doesn't exist.");
  return NextResponse.json(
    {
      job: { id: data.job.id, title: data.job.title, status: data.job.status, workMode: data.job.workMode, city: data.job.city, applicationCount: data.job.applicationCount },
      applicants: data.apps.map((a) => ({
        id: a.id,
        status: a.status,
        stage: a.stage,
        matchScore: a.matchScore,
        rating: a.rating,
        appliedAt: a.createdAt.toISOString(),
        viewed: !!a.viewedAt,
        priority: !!a.priorityAt,
        interviews: a._count.interviews,
        notes: a._count.notes,
        candidate: {
          name: a.applicant.name,
          username: a.applicant.username,
          image: a.applicant.image,
          headline: a.applicant.profile?.headline ?? null,
          city: a.applicant.profile?.city ?? null,
          countryCode: a.applicant.profile?.countryCode ?? null,
          yearsExperience: a.applicant.profile?.yearsExperience ?? null,
          availability: a.applicant.profile?.availability ?? null,
        },
      })),
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
