import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { db, type Prisma } from "@/server/db";
import { COMPANY_SIZES, type CompanySize } from "@/lib/constants";
import { resolveCountryCode } from "@/lib/geo";
import { companyCreateSchema } from "@/lib/validation/profile";
import { LIMITS, rateLimit } from "@/server/rate-limit";
import { companyCardSelect, createCompanyForUser, publicCompanyWhere } from "@/server/services/companies";
import { cacheHeaders, getMobileSession, mobileError } from "@/server/mobile/auth";
import { memberCompany, toCompanyCard } from "@/server/mobile/dto";

export const dynamic = "force-dynamic";

const PER_PAGE = 20;

// GET /api/mobile/companies?q=&industry=&size=&location=&hiring=1&page=1  →  { companies, page, pageCount, total }
// Same filters and order as the website's /companies page (imported companies only once they have an open job).
// With a bearer token each company also says whether the member follows it.
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const str = (key: string, max = 80) => (sp.get(key) ?? "").trim().slice(0, max);
  const q = str("q");
  const industry = str("industry", 60);
  const size = COMPANY_SIZES.includes(str("size") as CompanySize) ? (str("size") as CompanySize) : "";
  const location = str("location");
  const page = Math.max(1, Math.min(200, Number(sp.get("page")) || 1));

  const and: Prisma.CompanyWhereInput[] = [];
  if (q) and.push({ OR: [{ name: { contains: q, mode: "insensitive" } }, { tagline: { contains: q, mode: "insensitive" } }] });
  if (industry) and.push({ industry: { slug: industry } });
  if (size) and.push({ size });
  if (location) {
    const code = resolveCountryCode(location);
    and.push({ OR: [{ city: { contains: location, mode: "insensitive" } }, ...(code ? [{ countryCode: code }] : [])] });
  }
  if (sp.get("hiring") === "1") and.push({ jobs: { some: { status: "OPEN" } } });
  const where: Prisma.CompanyWhereInput = { AND: [...and, publicCompanyWhere] };

  const session = await getMobileSession(req);
  const [companies, total, follows] = await Promise.all([
    db.company.findMany({
      where,
      select: companyCardSelect,
      orderBy: [{ premiumUntil: { sort: "desc", nulls: "last" } }, { followerCount: "desc" }],
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
    }),
    db.company.count({ where }),
    session ? db.companyFollower.findMany({ where: { userId: session.user.id }, select: { companyId: true } }) : [],
  ]);
  const followed = new Set(follows.map((f) => f.companyId));
  const now = Date.now();
  return NextResponse.json(
    {
      companies: companies.map((c) => toCompanyCard(c, session ? followed.has(c.id) : null, now)),
      page,
      pageCount: Math.max(1, Math.ceil(total / PER_PAGE)),
      total,
    },
    { headers: cacheHeaders(!!session) },
  );
}

// POST /api/mobile/companies  (Authorization: Bearer <token>)
//   { name, size, website?, city?, countryCode?, tagline?, title? }  ->  201 { company }
// Creates the member's hiring company, exactly like the website's "Set up your company" step: one company per
// member, they become its OWNER, and a job seeker becomes "both" (seeker and recruiter).
export async function POST(req: Request) {
  const session = await getMobileSession(req);
  if (!session) return mobileError(401, "UNAUTHORIZED", "Sign in first.");
  const userId = session.user.id;
  const limit = rateLimit(`${LIMITS.write.key}:${userId}`, LIMITS.write.max, LIMITS.write.windowMs);
  if (!limit.ok) return mobileError(429, "RATE_LIMITED", `Too many requests. Try again in ${limit.retryAfterSeconds} s.`);
  if (await memberCompany(userId)) return mobileError(409, "ALREADY_IN_COMPANY", "You already belong to a company.");

  // The website's form always sends `website` (possibly empty) and the shared schema expects the key; the app may omit it.
  const input = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const parsed = companyCreateSchema.safeParse(input && typeof input === "object" ? { website: null, ...input } : input);
  if (!parsed.success) {
    const fields = [...new Set(parsed.error.issues.map((i) => String(i.path[0] ?? "body")))];
    return NextResponse.json(
      { error: { code: "INVALID_FIELDS", message: "Check the highlighted fields.", fields } },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  await db.$transaction(async (tx) => {
    await createCompanyForUser(userId, parsed.data, tx);
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { intent: true, onboardedAt: true } });
    await tx.user.update({
      where: { id: userId },
      data: { intent: user.intent === "SEEKER" ? "BOTH" : user.intent, onboardedAt: user.onboardedAt ?? new Date() },
    });
  });
  revalidatePath("/", "layout");
  return NextResponse.json({ company: await memberCompany(userId) }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
