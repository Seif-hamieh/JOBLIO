import { NextResponse } from "next/server";
import { parseJobSearch } from "@/lib/validation/search";
import { searchJobs } from "@/server/services/jobs";
import { cacheHeaders, getMobileSession } from "@/server/mobile/auth";
import { toJobCard } from "@/server/mobile/dto";

export const dynamic = "force-dynamic";

// GET /api/mobile/jobs?q=&location=&mode=REMOTE&type=&level=&salary=&skills=&posted=&sort=newest&page=1
// Same filters, ranking and sponsored slots as the website's /jobs page. With a bearer token each job also carries
// the member's match score and whether they saved / applied (and sort=match becomes available).
export async function GET(req: Request) {
  const session = await getMobileSession(req);
  const params = parseJobSearch(Object.fromEntries(new URL(req.url).searchParams));
  const { jobs, sponsored, total, pageCount } = await searchJobs(params, session?.user.id ?? null);
  const now = Date.now();
  return NextResponse.json(
    {
      sponsored: sponsored.map((j) => toJobCard(j, now)),
      jobs: jobs.map((j) => toJobCard(j, now)),
      page: params.page,
      pageCount,
      total,
    },
    { headers: cacheHeaders(!!session) },
  );
}
