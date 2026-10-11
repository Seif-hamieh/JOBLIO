import "server-only";
import { db, type Prisma } from "@/server/db";
import { slugify } from "@/lib/utils";
import { RESERVED_USERNAMES } from "@/lib/constants";
import { ensureReferenceData } from "@/server/services/reference-data";
import type { z } from "zod";
import type { companyCreateSchema } from "@/lib/validation/profile";

export async function uniqueCompanySlug(name: string, tx: Prisma.TransactionClient = db) {
  const base = slugify(name) || "company";
  for (let i = 0; i < 20; i++) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`;
    if (RESERVED_USERNAMES.has(candidate)) continue;
    const exists = await tx.company.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!exists) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

export async function createCompanyForUser(userId: string, input: z.infer<typeof companyCreateSchema>, tx: Prisma.TransactionClient = db) {
  const slug = await uniqueCompanySlug(input.name, tx);
  return tx.company.create({
    data: {
      slug,
      name: input.name,
      website: input.website,
      industryId: input.industryId || null,
      size: input.size,
      city: input.city,
      countryCode: input.countryCode,
      tagline: input.tagline,
      members: { create: { userId, role: "OWNER", title: input.title } },
    },
  });
}

export const companyCardSelect = {
  id: true,
  slug: true,
  name: true,
  tagline: true,
  logoUrl: true,
  coverUrl: true,
  brandColor: true,
  verified: true,
  size: true,
  city: true,
  countryCode: true,
  followerCount: true,
  premiumUntil: true,
  industry: { select: { name: true, slug: true } },
  _count: { select: { jobs: { where: { status: "OPEN" } } } },
} satisfies Prisma.CompanySelect;

export type CompanyCard = Prisma.CompanyGetPayload<{ select: typeof companyCardSelect }>;

export async function listIndustries() {
  await ensureReferenceData();
  return db.industry.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, slug: true } });
}
