import "server-only";
import { db, type Prisma } from "@/server/db";
import { searchJobs } from "@/server/services/jobs";
import { companyCardSelect } from "@/server/services/companies";
import { connectionIds } from "@/server/services/network";
import { parseJobSearch } from "@/lib/validation/search";

/**
 * One search box for people, companies and jobs. People respect each owner's
 * profile visibility and blocks, exactly like opening their profile would.
 */
export async function globalSearch(query: string, viewerId: string | null, limits = { people: 8, companies: 6, jobs: 6 }) {
  const q = query.trim().slice(0, 100);
  if (!q) return { q, people: [], companies: [], jobs: [], jobTotal: 0 };

  const [connections, blocks] = viewerId
    ? await Promise.all([
        connectionIds(viewerId),
        db.block.findMany({ where: { OR: [{ blockerId: viewerId }, { blockedId: viewerId }] }, select: { blockerId: true, blockedId: true } }),
      ])
    : [[], []];
  const blocked = blocks.flatMap((b) => [b.blockerId, b.blockedId]).filter((id) => id !== viewerId);

  // Visible to this viewer: public profiles, member-only profiles when signed in, connection-only profiles of connections.
  const visibility: Prisma.UserWhereInput = {
    OR: [
      { profile: { visibility: "PUBLIC" } },
      ...(viewerId ? [{ profile: { visibility: "MEMBERS" as const } }, { id: { in: [...connections, viewerId] } }] : []),
    ],
  };
  const text: Prisma.UserWhereInput = {
    OR: [
      { name: { contains: q, mode: "insensitive" } },
      { username: { contains: q.toLowerCase() } },
      { profile: { headline: { contains: q, mode: "insensitive" } } },
    ],
  };

  const [people, companies, jobs] = await Promise.all([
    db.user.findMany({
      where: { AND: [text, visibility, { id: { notIn: blocked } }, { username: { not: null } }, { profile: { isNot: null } }] },
      orderBy: [{ profile: { profileViewCount: "desc" } }, { name: "asc" }],
      take: limits.people,
      select: {
        id: true,
        name: true,
        image: true,
        username: true,
        profile: { select: { headline: true, city: true, countryCode: true, openToWork: true } },
      },
    }),
    db.company.findMany({
      where: { OR: [{ name: { contains: q, mode: "insensitive" } }, { tagline: { contains: q, mode: "insensitive" } }] },
      orderBy: [{ followerCount: "desc" }, { name: "asc" }],
      take: limits.companies,
      select: { ...companyCardSelect, _count: { select: { jobs: { where: { status: "OPEN" } } } } },
    }),
    searchJobs(parseJobSearch({ q }), viewerId),
  ]);

  return { q, people, companies, jobs: [...jobs.sponsored, ...jobs.jobs].slice(0, limits.jobs), jobTotal: jobs.total };
}
