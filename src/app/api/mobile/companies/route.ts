import { NextResponse } from "next/server";
import { db, type Prisma } from "@/server/db";
import { COMPANY_SIZES, type CompanySize } from "@/lib/constants";
import { resolveCountryCode } from "@/lib/geo";
import { companyCardSelect, publicCompanyWhere } from "@/server/services/companies";
import { cacheHeaders, getMobileSession } from "@/server/mobile/auth";
import { toCompanyCard } from "@/server/mobile/dto";

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
