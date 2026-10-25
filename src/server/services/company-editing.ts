import "server-only";
import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { db } from "@/server/db";
import { refreshSitemap } from "@/server/sitemap";
import { deleteStored, storeUpload } from "@/server/storage";
import type { companyProfileSchema } from "@/lib/validation/profile";

// Editing a company page, shared by the website's company dashboard and the mobile API. Callers check that the
// member is an owner or admin of the company first. Upload problems throw UploadError (from storage).

/** Saves the page's text and details. The brand colour is kept only for Premium pages. Returns the message key. */
export async function updateCompanyPage(companyId: string, data: z.output<typeof companyProfileSchema>) {
  const company = await db.company.findUniqueOrThrow({ where: { id: companyId }, select: { premiumUntil: true, slug: true } });
  const premium = !!company.premiumUntil && company.premiumUntil > new Date();
  const { brandColor, ...rest } = data;
  await db.company.update({
    where: { id: companyId },
    // Brand colour customisation is a Premium Company Page feature.
    data: { ...rest, industryId: rest.industryId || null, ...(premium ? { brandColor } : {}) },
  });
  revalidatePath(`/companies/${company.slug}`);
  revalidatePath("/company/dashboard");
  refreshSitemap();
  return premium || !brandColor ? "@msg.pageUpdated" : "@msg.brandNeedsPremium";
}

/** A new logo or cover (checked by its real contents); the old file is deleted. Returns the new URL. */
export async function setCompanyImage(companyId: string, kind: "logo" | "cover", file: File) {
  const stored = await storeUpload(file, "company", companyId);
  const old = await db.company.findUniqueOrThrow({ where: { id: companyId }, select: { logoUrl: true, coverUrl: true, slug: true } });
  await db.company.update({ where: { id: companyId }, data: kind === "logo" ? { logoUrl: stored.url } : { coverUrl: stored.url } });
  await deleteStored([kind === "logo" ? old.logoUrl : old.coverUrl]);
  revalidatePath("/company/dashboard");
  revalidatePath(`/companies/${old.slug}`);
  return stored.url;
}
