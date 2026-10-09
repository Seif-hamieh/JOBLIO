"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db";
import { fail, parse, withRecruiter, withViewer, type ActionState } from "@/server/action";
import { LIMITS } from "@/server/rate-limit";
import { canManageCompany } from "@/server/session";
import { checkAchievements } from "@/server/services/achievements";
import { createCompanyForUser } from "@/server/services/companies";
import { deleteStored, storeUpload, UploadError } from "@/server/storage";
import { companyCreateSchema, companyProfileSchema } from "@/lib/validation/profile";

const id = z.string().min(1).max(40);

export async function toggleFollowCompany(companyId: string): Promise<ActionState<{ following: boolean }>> {
  return withViewer({ limit: LIMITS.write }, async (viewer) => {
    const cid = id.parse(companyId);
    const key = { userId_companyId: { userId: viewer.id, companyId: cid } };
    const existing = await db.companyFollower.findUnique({ where: key });
    if (existing) {
      await db.$transaction([db.companyFollower.delete({ where: key }), db.company.update({ where: { id: cid }, data: { followerCount: { decrement: 1 } } })]);
    } else {
      const company = await db.company.findUnique({ where: { id: cid }, select: { id: true } });
      if (!company) return fail("@msg.companyNotFound");
      await db.$transaction([db.companyFollower.create({ data: { userId: viewer.id, companyId: cid } }), db.company.update({ where: { id: cid }, data: { followerCount: { increment: 1 } } })]);
      await checkAchievements(viewer.id, ["CAREER_EXPLORER"]);
    }
    revalidatePath("/companies");
    return { ok: true, data: { following: !existing } };
  });
}

export async function createCompanyAction(input: z.input<typeof companyCreateSchema>): Promise<ActionState<{ slug: string }>> {
  return withViewer({ limit: LIMITS.write }, async (viewer) => {
    if (viewer.company) return fail("@msg.alreadyInCompany");
    const parsed = parse(companyCreateSchema, input);
    if (!parsed.success) return parsed.state;
    const company = await db.$transaction(async (tx) => {
      const c = await createCompanyForUser(viewer.id, parsed.data, tx);
      await tx.user.update({ where: { id: viewer.id }, data: { intent: viewer.intent === "SEEKER" ? "BOTH" : viewer.intent, onboardedAt: viewer.onboardedAt ?? new Date() } });
      return c;
    });
    revalidatePath("/", "layout");
    return { ok: true, data: { slug: company.slug } };
  });
}

export async function updateCompanyAction(companyId: string, input: z.input<typeof companyProfileSchema>): Promise<ActionState> {
  return withRecruiter({ limit: LIMITS.write }, async (viewer) => {
    if (!canManageCompany(viewer, companyId)) return fail("@msg.adminsOnlyEdit");
    const parsed = parse(companyProfileSchema, input);
    if (!parsed.success) return parsed.state;
    const company = await db.company.findUniqueOrThrow({ where: { id: companyId }, select: { premiumUntil: true, slug: true } });
    const premium = !!company.premiumUntil && company.premiumUntil > new Date();
    const { brandColor, ...rest } = parsed.data;
    await db.company.update({
      where: { id: companyId },
      // Brand colour customisation is a Premium Company Page feature.
      data: { ...rest, industryId: rest.industryId || null, ...(premium ? { brandColor } : {}) },
    });
    revalidatePath(`/companies/${company.slug}`);
    revalidatePath("/company/dashboard");
    return { ok: true, message: premium || !brandColor ? "@msg.pageUpdated" : "@msg.brandNeedsPremium" };
  });
}

export async function uploadCompanyImageAction(form: FormData): Promise<ActionState<{ url: string }>> {
  return withRecruiter({ limit: LIMITS.upload }, async (viewer) => {
    if (!canManageCompany(viewer, viewer.company.id)) return fail("@msg.adminsOnlyImages");
    const kind = z.enum(["logo", "cover", "media"]).parse(form.get("kind"));
    const file = form.get("file");
    if (!(file instanceof File)) return fail("@msg.chooseImage");
    try {
      const stored = await storeUpload(file, "company", viewer.company.id);
      const companyId = viewer.company.id;
      if (kind === "logo" || kind === "cover") {
        const old = await db.company.findUniqueOrThrow({ where: { id: companyId }, select: { logoUrl: true, coverUrl: true } });
        await db.company.update({ where: { id: companyId }, data: kind === "logo" ? { logoUrl: stored.url } : { coverUrl: stored.url } });
        await deleteStored([kind === "logo" ? old.logoUrl : old.coverUrl]);
      } else {
        const company = await db.company.findUniqueOrThrow({ where: { id: companyId }, select: { premiumUntil: true, _count: { select: { media: true } } } });
        const limit = company.premiumUntil && company.premiumUntil > new Date() ? 30 : 6;
        if (company._count.media >= limit) {
          await deleteStored([stored.url]);
          return fail(`@msg.photoLimit?{"n":${limit}}`);
        }
        await db.companyMedia.create({ data: { companyId, type: "PHOTO", url: stored.url, caption: String(form.get("caption") ?? "").slice(0, 120) || null, position: company._count.media } });
      }
      revalidatePath("/company/dashboard");
      revalidatePath(`/companies/${viewer.company.slug}`);
      return { ok: true, data: { url: stored.url } };
    } catch (e) {
      if (e instanceof UploadError) return fail(e.message);
      throw e;
    }
  });
}

export async function deleteCompanyMediaAction(mediaId: string): Promise<ActionState> {
  return withRecruiter({ limit: LIMITS.write }, async (viewer) => {
    if (!canManageCompany(viewer, viewer.company.id)) return fail("@msg.adminsOnlyImages");
    const media = await db.companyMedia.findFirst({ where: { id: id.parse(mediaId), companyId: viewer.company.id }, select: { id: true, url: true } });
    if (media) {
      await db.companyMedia.delete({ where: { id: media.id } });
      await deleteStored([media.url]);
    }
    revalidatePath("/company/dashboard");
    revalidatePath(`/companies/${viewer.company.slug}`);
    return { ok: true };
  });
}
