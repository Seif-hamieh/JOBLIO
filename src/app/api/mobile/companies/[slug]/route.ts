import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { getFeed } from "@/server/services/feed";
import { annotateForViewer, jobCardSelect } from "@/server/services/jobs";
import { personCardSelect } from "@/server/services/network";
import { getMobileSession, mobileError } from "@/server/mobile/auth";
import { toJobCard } from "@/server/mobile/dto";
import { toPost } from "@/server/mobile/feed";
import { toPerson } from "@/server/mobile/network";

export const dynamic = "force-dynamic";

// GET /api/mobile/companies/:slug  →  { company, jobs, people, peopleCount, posts, following, isMember }
// A company page, as on the website: the intro, about, culture, benefits and values; its open jobs (with your match
// score), people who work there and its latest posts. Imported companies stay hidden until they have an open job.
export async function GET(req: Request, { params }: RouteContext<"/api/mobile/companies/[slug]">) {
  const session = await getMobileSession(req);
  if (!session) return mobileError(401, "UNAUTHORIZED", "Sign in first.");
  const viewerId = session.user.id;
  const { slug } = await params;
  const company = await db.company.findUnique({
    where: { slug: decodeURIComponent(slug).slice(0, 80) },
    select: {
      id: true,
      slug: true,
      name: true,
      tagline: true,
      about: true,
      cultureText: true,
      benefits: true,
      values: true,
      website: true,
      foundedYear: true,
      size: true,
      city: true,
      countryCode: true,
      logoUrl: true,
      coverUrl: true,
      brandColor: true,
      verified: true,
      premiumUntil: true,
      followerCount: true,
      importSource: true,
      industry: { select: { name: true } },
      _count: { select: { jobs: { where: { status: "OPEN" } }, members: true } },
    },
  });
  const viewer = await db.user.findUnique({ where: { id: viewerId }, select: { platformRole: true } });
  if (!company || (company.importSource && company._count.jobs === 0 && viewer?.platformRole !== "ADMIN")) return mobileError(404, "NOT_FOUND", "This company page doesn't exist.");

  const atCompany = { OR: [{ companyMemberships: { some: { companyId: company.id } } }, { profile: { experiences: { some: { companyId: company.id, isCurrent: true } } } }] };
  const [jobs, people, peopleCount, following, feed, membership] = await Promise.all([
    db.job.findMany({
      where: { companyId: company.id, status: "OPEN" },
      select: jobCardSelect,
      orderBy: [{ featuredUntil: { sort: "desc", nulls: "last" } }, { publishedAt: "desc" }],
      take: 20,
    }),
    db.user.findMany({
      where: { OR: [{ companyMemberships: { some: { companyId: company.id } } }, { profile: { experiences: { some: { companyId: company.id, isCurrent: true } }, visibility: { not: "CONNECTIONS" } } }] },
      select: personCardSelect,
      take: 12,
    }),
    db.user.count({ where: atCompany }),
    db.companyFollower.findUnique({ where: { userId_companyId: { userId: viewerId, companyId: company.id } }, select: { userId: true } }),
    getFeed(viewerId, { companyId: company.id }),
    db.companyMember.findFirst({ where: { userId: viewerId, companyId: company.id }, select: { id: true } }),
  ]);
  const now = Date.now();
  const annotated = await annotateForViewer(jobs, viewerId);
  return NextResponse.json(
    {
      company: {
        id: company.id,
        slug: company.slug,
        name: company.name,
        tagline: company.tagline,
        about: company.about,
        culture: company.cultureText,
        benefits: company.benefits,
        values: company.values,
        website: company.website,
        foundedYear: company.foundedYear,
        size: company.size,
        industry: company.industry?.name ?? null,
        city: company.city,
        countryCode: company.countryCode,
        logoUrl: company.logoUrl,
        coverUrl: company.coverUrl,
        brandColor: company.brandColor,
        verified: company.verified,
        premium: !!company.premiumUntil && company.premiumUntil.getTime() > now,
        followerCount: company.followerCount,
        openJobs: company._count.jobs,
        teamSize: company._count.members,
      },
      jobs: annotated.map((j) => toJobCard(j, now)),
      people: people.map(toPerson),
      peopleCount,
      posts: feed.posts.slice(0, 5).map((p) => toPost(p, viewerId)),
      following: !!following,
      isMember: !!membership,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
