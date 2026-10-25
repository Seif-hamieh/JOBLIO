import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { updateCompanyPage } from "@/server/services/company-editing";
import { ActionError } from "@/server/action";
import { getMobileRecruiter } from "@/server/mobile/auth";
import { canManage, invalidFields, recruiterChange } from "@/server/mobile/recruiter";
import { companyProfileSchema } from "@/lib/validation/profile";

export const dynamic = "force-dynamic";

// GET /api/mobile/recruiter/company  →  { company, canEdit, team }
// Your company page as the website's company dashboard edits it, plus the team. canEdit: owners and admins only.
export async function GET(req: Request) {
  const r = await getMobileRecruiter(req);
  if ("error" in r) return r.error;
  const [company, team, editable] = await Promise.all([
    db.company.findUniqueOrThrow({
      where: { id: r.companyId },
      select: {
        id: true,
        slug: true,
        name: true,
        tagline: true,
        about: true,
        website: true,
        industryId: true,
        size: true,
        foundedYear: true,
        city: true,
        countryCode: true,
        benefits: true,
        values: true,
        cultureText: true,
        brandColor: true,
        logoUrl: true,
        coverUrl: true,
        verified: true,
        premiumUntil: true,
        followerCount: true,
      },
    }),
    db.companyMember.findMany({ where: { companyId: r.companyId }, orderBy: { createdAt: "asc" }, select: { role: true, title: true, user: { select: { name: true, image: true, username: true } } } }),
    canManage(r),
  ]);
  const { premiumUntil, ...rest } = company;
  return NextResponse.json(
    {
      company: { ...rest, premium: !!premiumUntil && premiumUntil > new Date() },
      canEdit: editable,
      team: team.map((m) => ({ role: m.role, title: m.title, name: m.user.name, image: m.user.image, username: m.user.username })),
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

// PATCH /api/mobile/recruiter/company  (the website's company form: name, tagline, about, website, industryId, size,
//   foundedYear, city, countryCode, benefits[], values[], cultureText, brandColor)  →  { message }
// Saves the public page. Owners and admins only; the brand colour only applies to Premium pages.
export async function PATCH(req: Request) {
  const parsed = companyProfileSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return invalidFields(parsed.error.issues);
  return recruiterChange(req, async (r) => {
    if (!(await canManage(r))) throw new ActionError("@msg.adminsOnlyEdit");
    return updateCompanyPage(r.companyId, parsed.data);
  });
}
