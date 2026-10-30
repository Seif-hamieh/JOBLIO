import "server-only";
import { db, type Prisma } from "@/server/db";
import { searchJobs } from "@/server/services/jobs";
import { companyCardSelect, publicCompanyWhere } from "@/server/services/companies";
import { connectionIds } from "@/server/services/network";
import { parseJobSearch } from "@/lib/validation/search";
import { hashtagQuery } from "@/lib/hashtags";

/** What a post in the results shows: author, text, picture or video still, counts. */
const searchPostSelect = {
  id: true,
  content: true,
  hashtags: true,
  mediaUrls: true,
  mediaType: true,
  thumbnailUrl: true,
  likeCount: true,
  commentCount: true,
  shareCount: true,
  createdAt: true,
  author: { select: { id: true, name: true, image: true, username: true, profile: { select: { headline: true } } } },
  company: { select: { name: true, slug: true, logoUrl: true } },
} satisfies Prisma.PostSelect;
export type SearchPost = Prisma.PostGetPayload<{ select: typeof searchPostSelect }>;

/**
 * One search box for people, companies, jobs and posts. Posts: "#dubai" finds the posts tagged #dubai; a plain word
 * also finds them (and posts with the word in their text). Posts follow the feed's rules: public ones, plus
 * connection-only ones from your connections (and your own); none from blocked or banned members. People respect each owner's
 * profile visibility and blocks, exactly like opening their profile would.
 */
export async function globalSearch(query: string, viewerId: string | null, limits = { people: 8, companies: 6, jobs: 6, posts: 6 }) {
  const raw = query.trim().slice(0, 100);
  if (!raw) return { q: raw, people: [], companies: [], jobs: [], jobTotal: 0, posts: [] as SearchPost[] };
  const tag = hashtagQuery(raw);
  // "#dubai" searches people, companies and jobs for "dubai".
  const q = raw.replace(/^#+/, "").trim() || raw;

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

  const postText: Prisma.PostWhereInput =
    raw.startsWith("#") && tag
      ? { hashtags: { has: tag } }
      : { OR: [...(tag ? [{ hashtags: { has: tag } }] : []), { content: { contains: q, mode: "insensitive" } }] };
  const postVisibility: Prisma.PostWhereInput = viewerId
    ? { OR: [{ visibility: "PUBLIC" }, { authorId: { in: [...connections, viewerId] } }] }
    : { visibility: "PUBLIC" };

  const [people, companies, jobs, posts] = await Promise.all([
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
      where: { AND: [{ OR: [{ name: { contains: q, mode: "insensitive" } }, { tagline: { contains: q, mode: "insensitive" } }] }, publicCompanyWhere] },
      orderBy: [{ followerCount: "desc" }, { name: "asc" }],
      take: limits.companies,
      select: { ...companyCardSelect, _count: { select: { jobs: { where: { status: "OPEN" } } } } },
    }),
    searchJobs(parseJobSearch({ q }), viewerId),
    limits.posts
      ? db.post.findMany({
          where: { AND: [postText, postVisibility, { authorId: { notIn: blocked } }, { author: { bannedAt: null } }] },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: limits.posts,
          select: searchPostSelect,
        })
      : Promise.resolve([] as SearchPost[]),
  ]);

  return { q: raw, people, companies, jobs: [...jobs.sponsored, ...jobs.jobs].slice(0, limits.jobs), jobTotal: jobs.total, posts };
}
