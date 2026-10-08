"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db";
import { fail, parse, withViewer, type ActionState } from "@/server/action";
import { LIMITS } from "@/server/rate-limit";
import type { Viewer } from "@/server/session";
import { refreshProfileDerived } from "@/server/services/profile";
import { storeUpload, UploadError } from "@/server/storage";
import {
  basicsSchema,
  certificateSchema,
  educationSchema,
  experienceSchema,
  languageSchema,
  preferencesSchema,
  privacySchema,
  projectSchema,
  skillEntrySchema,
  socialLinkSchema,
} from "@/lib/validation/profile";
import { SKILL_LEVELS } from "@/lib/constants";

const id = z.string().min(1).max(40);

async function done(viewer: Viewer, message = "@msg.saved") {
  await refreshProfileDerived(viewer.profileId);
  revalidatePath(`/in/${viewer.username}`);
  revalidatePath("/profile", "layout");
  revalidatePath("/home");
  return { ok: true as const, message };
}

// ── Basics & media ───────────────────────────────────────────────────────

export async function updateBasicsAction(input: z.input<typeof basicsSchema>): Promise<ActionState> {
  return withViewer({ limit: LIMITS.write }, async (viewer) => {
    const parsed = parse(basicsSchema, input);
    if (!parsed.success) return parsed.state;
    const { name, ...rest } = parsed.data;
    await db.$transaction([db.user.update({ where: { id: viewer.id }, data: { name } }), db.profile.update({ where: { id: viewer.profileId }, data: rest })]);
    return done(viewer, "@msg.profileUpdated");
  });
}

export async function uploadProfileImageAction(form: FormData): Promise<ActionState<{ url: string }>> {
  return withViewer<{ url: string }>({ limit: LIMITS.upload }, async (viewer) => {
    const kind = z.enum(["avatar", "cover"]).parse(form.get("kind"));
    const file = form.get("file");
    if (!(file instanceof File)) return fail("@msg.chooseImage");
    try {
      const stored = await storeUpload(file, kind, viewer.id);
      if (kind === "avatar") await db.user.update({ where: { id: viewer.id }, data: { image: stored.url } });
      else await db.profile.update({ where: { id: viewer.profileId }, data: { coverUrl: stored.url } });
      const res = await done(viewer, kind === "avatar" ? "@msg.photoUpdated" : "@msg.coverUpdated");
      return { ...res, data: { url: stored.url } };
    } catch (e) {
      if (e instanceof UploadError) return fail(e.message);
      throw e;
    }
  });
}

export async function removeProfileImageAction(kind: "avatar" | "cover"): Promise<ActionState> {
  return withViewer({ limit: LIMITS.write }, async (viewer) => {
    if (kind === "avatar") await db.user.update({ where: { id: viewer.id }, data: { image: null } });
    else await db.profile.update({ where: { id: viewer.profileId }, data: { coverUrl: null } });
    return done(viewer, "@msg.removed");
  });
}

export async function updatePreferencesAction(input: z.input<typeof preferencesSchema>): Promise<ActionState> {
  return withViewer({ limit: LIMITS.write }, async (viewer) => {
    const parsed = parse(preferencesSchema, input);
    if (!parsed.success) return parsed.state;
    const p = parsed.data;
    await db.profile.update({
      where: { id: viewer.profileId },
      data: {
        openToWork: p.openToWork,
        availability: p.openToWork ? p.availability : "NOT_LOOKING",
        desiredTitles: p.desiredTitles,
        preferredWorkModes: p.preferredWorkModes,
        preferredEmploymentTypes: p.preferredEmploymentTypes,
        preferredCities: p.preferredCities.map((c) => c.toLowerCase()),
        openToRelocate: p.openToRelocate,
        desiredSalaryMin: p.desiredSalaryMin,
        salaryCurrency: p.salaryCurrency,
        salaryPeriod: p.salaryPeriod,
        preferredIndustries: { set: p.industryIds.map((i) => ({ id: i })) },
      },
    });
    return done(viewer, "@msg.prefsSaved");
  });
}

// ── Experience / education / certificates ───────────────────────────────

export async function upsertExperienceAction(input: z.input<typeof experienceSchema>): Promise<ActionState> {
  return withViewer({ limit: LIMITS.write }, async (viewer) => {
    const parsed = parse(experienceSchema, input);
    if (!parsed.success) return parsed.state;
    const { id: expId, ...data } = parsed.data;
    // Link to a JOBLIO company page when the name matches exactly.
    const company = await db.company.findFirst({ where: { name: { equals: data.companyName, mode: "insensitive" } }, select: { id: true } });
    const row = { ...data, endDate: data.isCurrent ? null : data.endDate, companyId: company?.id ?? null };
    if (expId) {
      const updated = await db.experience.updateMany({ where: { id: expId, profileId: viewer.profileId }, data: row });
      if (!updated.count) return fail("@msg.expNotFound");
    } else {
      if ((await db.experience.count({ where: { profileId: viewer.profileId } })) >= 40) return fail("@msg.maxRoles");
      await db.experience.create({ data: { ...row, profileId: viewer.profileId } });
    }
    return done(viewer);
  });
}

export async function deleteExperienceAction(expId: string): Promise<ActionState> {
  return withViewer({ limit: LIMITS.write }, async (viewer) => {
    await db.experience.deleteMany({ where: { id: id.parse(expId), profileId: viewer.profileId } });
    return done(viewer, "@msg.removed");
  });
}

export async function upsertEducationAction(input: z.input<typeof educationSchema>): Promise<ActionState> {
  return withViewer({ limit: LIMITS.write }, async (viewer) => {
    const parsed = parse(educationSchema, input);
    if (!parsed.success) return parsed.state;
    const { id: eduId, ...data } = parsed.data;
    if (eduId) {
      const updated = await db.education.updateMany({ where: { id: eduId, profileId: viewer.profileId }, data });
      if (!updated.count) return fail("@msg.eduNotFound");
    } else {
      if ((await db.education.count({ where: { profileId: viewer.profileId } })) >= 20) return fail("@msg.maxEdu");
      await db.education.create({ data: { ...data, profileId: viewer.profileId } });
    }
    return done(viewer);
  });
}

export async function deleteEducationAction(eduId: string): Promise<ActionState> {
  return withViewer({ limit: LIMITS.write }, async (viewer) => {
    await db.education.deleteMany({ where: { id: id.parse(eduId), profileId: viewer.profileId } });
    return done(viewer, "@msg.removed");
  });
}

export async function upsertCertificateAction(input: z.input<typeof certificateSchema>): Promise<ActionState> {
  return withViewer({ limit: LIMITS.write }, async (viewer) => {
    const parsed = parse(certificateSchema, input);
    if (!parsed.success) return parsed.state;
    const { id: certId, ...data } = parsed.data;
    if (certId) {
      const updated = await db.certificate.updateMany({ where: { id: certId, profileId: viewer.profileId }, data });
      if (!updated.count) return fail("@msg.certNotFound");
    } else {
      if ((await db.certificate.count({ where: { profileId: viewer.profileId } })) >= 30) return fail("@msg.maxCerts");
      await db.certificate.create({ data: { ...data, profileId: viewer.profileId } });
    }
    return done(viewer);
  });
}

export async function deleteCertificateAction(certId: string): Promise<ActionState> {
  return withViewer({ limit: LIMITS.write }, async (viewer) => {
    await db.certificate.deleteMany({ where: { id: id.parse(certId), profileId: viewer.profileId } });
    return done(viewer, "@msg.removed");
  });
}

export async function setLanguagesAction(list: z.input<typeof languageSchema>[]): Promise<ActionState> {
  return withViewer({ limit: LIMITS.write }, async (viewer) => {
    const parsed = parse(z.array(languageSchema).max(15), list);
    if (!parsed.success) return parsed.state;
    const unique = parsed.data.filter((l, i, arr) => arr.findIndex((x) => x.languageCode === l.languageCode) === i);
    await db.$transaction([
      db.userLanguage.deleteMany({ where: { profileId: viewer.profileId } }),
      db.userLanguage.createMany({ data: unique.map((l) => ({ ...l, profileId: viewer.profileId })) }),
    ]);
    return done(viewer, "@msg.languagesSaved");
  });
}

export async function setSocialLinksAction(list: z.input<typeof socialLinkSchema>[]): Promise<ActionState> {
  return withViewer({ limit: LIMITS.write }, async (viewer) => {
    const parsed = parse(z.array(socialLinkSchema).max(8), list);
    if (!parsed.success) return parsed.state;
    const unique = parsed.data.filter((l, i, arr) => arr.findIndex((x) => x.platform === l.platform) === i);
    await db.$transaction([
      db.socialLink.deleteMany({ where: { profileId: viewer.profileId } }),
      db.socialLink.createMany({ data: unique.map((l) => ({ ...l, profileId: viewer.profileId })) }),
    ]);
    return done(viewer, "@msg.linksSaved");
  });
}

// ── Skills ───────────────────────────────────────────────────────────────

export async function addSkillAction(input: z.input<typeof skillEntrySchema>): Promise<ActionState<{ userSkillId: string }>> {
  return withViewer<{ userSkillId: string }>({ limit: LIMITS.write }, async (viewer) => {
    const parsed = parse(skillEntrySchema, input);
    if (!parsed.success) return parsed.state;
    const skill = await db.skill.findUnique({ where: { id: parsed.data.skillId }, select: { id: true } });
    if (!skill) return fail("@msg.unknownSkill");
    const count = await db.userSkill.count({ where: { profileId: viewer.profileId } });
    if (count >= 50) return fail("@msg.maxSkills");
    const us = await db.userSkill.upsert({
      where: { profileId_skillId: { profileId: viewer.profileId, skillId: skill.id } },
      create: { profileId: viewer.profileId, skillId: skill.id, level: parsed.data.level, position: count },
      update: { level: parsed.data.level },
    });
    await db.skill.update({ where: { id: skill.id }, data: { usageCount: { increment: 1 } } });
    const res = await done(viewer, "@msg.skillAdded");
    return { ...res, data: { userSkillId: us.id } };
  });
}

const skillUpdateSchema = z.object({
  level: z.enum(SKILL_LEVELS).optional(),
  years: z.coerce.number().min(0).max(60).nullable().optional(),
  isTop: z.boolean().optional(),
});

export async function updateSkillAction(userSkillId: string, input: z.input<typeof skillUpdateSchema>): Promise<ActionState> {
  return withViewer({ limit: LIMITS.write }, async (viewer) => {
    const parsed = parse(skillUpdateSchema, input);
    if (!parsed.success) return parsed.state;
    if (parsed.data.isTop) {
      const tops = await db.userSkill.count({ where: { profileId: viewer.profileId, isTop: true, id: { not: id.parse(userSkillId) } } });
      if (tops >= 3) return fail("@msg.maxTop");
    }
    const updated = await db.userSkill.updateMany({ where: { id: id.parse(userSkillId), profileId: viewer.profileId }, data: parsed.data });
    if (!updated.count) return fail("@msg.skillNotFound");
    return done(viewer);
  });
}

export async function removeSkillAction(userSkillId: string): Promise<ActionState> {
  return withViewer({ limit: LIMITS.write }, async (viewer) => {
    await db.userSkill.deleteMany({ where: { id: id.parse(userSkillId), profileId: viewer.profileId } });
    return done(viewer, "@msg.skillRemoved");
  });
}

export async function reorderSkillsAction(orderedIds: string[]): Promise<ActionState> {
  return withViewer({ limit: LIMITS.write }, async (viewer) => {
    const ids = z.array(id).max(50).parse(orderedIds);
    await db.$transaction(ids.map((usId, position) => db.userSkill.updateMany({ where: { id: usId, profileId: viewer.profileId }, data: { position } })));
    revalidatePath(`/in/${viewer.username}`);
    return { ok: true };
  });
}

// ── Projects ─────────────────────────────────────────────────────────────

export async function upsertProjectAction(input: z.input<typeof projectSchema>): Promise<ActionState> {
  return withViewer({ limit: LIMITS.write }, async (viewer) => {
    const parsed = parse(projectSchema, input);
    if (!parsed.success) return parsed.state;
    const { id: projectId, skillIds, imageUrl, ...data } = parsed.data;
    // Only accept images uploaded through our own storage.
    const image = imageUrl && (imageUrl.startsWith("/api/v1/files/public/project/") || imageUrl.startsWith("/media/")) ? imageUrl : null;
    const skills = (await db.skill.findMany({ where: { id: { in: skillIds } }, select: { id: true } })).map((s) => ({ id: s.id }));
    if (projectId) {
      const existing = await db.project.findFirst({ where: { id: projectId, profileId: viewer.profileId }, select: { id: true } });
      if (!existing) return fail("@msg.projectNotFound");
      await db.project.update({ where: { id: projectId }, data: { ...data, featured: !!data.featured, imageUrl: image, skills: { set: skills } } });
    } else {
      const count = await db.project.count({ where: { profileId: viewer.profileId } });
      if (count >= 30) return fail("@msg.maxProjects");
      await db.project.create({ data: { ...data, featured: !!data.featured, imageUrl: image, profileId: viewer.profileId, position: count, skills: { connect: skills } } });
    }
    return done(viewer, "@msg.projectSaved");
  });
}

export async function deleteProjectAction(projectId: string): Promise<ActionState> {
  return withViewer({ limit: LIMITS.write }, async (viewer) => {
    await db.project.deleteMany({ where: { id: id.parse(projectId), profileId: viewer.profileId } });
    return done(viewer, "@msg.projectRemoved");
  });
}

export async function uploadProjectImageAction(form: FormData): Promise<ActionState<{ url: string }>> {
  return withViewer<{ url: string }>({ limit: LIMITS.upload }, async (viewer) => {
    const file = form.get("file");
    if (!(file instanceof File)) return fail("@msg.chooseImage");
    try {
      const stored = await storeUpload(file, "project", viewer.id);
      return { ok: true, data: { url: stored.url } };
    } catch (e) {
      if (e instanceof UploadError) return fail(e.message);
      throw e;
    }
  });
}

// ── Privacy & portfolio ──────────────────────────────────────────────────

export async function updatePrivacyAction(input: z.input<typeof privacySchema>): Promise<ActionState> {
  return withViewer({ limit: LIMITS.write }, async (viewer) => {
    const parsed = parse(privacySchema, input);
    if (!parsed.success) return parsed.state;
    await db.profile.update({ where: { id: viewer.profileId }, data: parsed.data });
    revalidatePath("/settings/privacy");
    revalidatePath(`/in/${viewer.username}`);
    return { ok: true, message: "@msg.privacySaved" };
  });
}

export async function updatePortfolioAction(input: { enabled: boolean; accent: string | null }): Promise<ActionState> {
  return withViewer({ limit: LIMITS.write }, async (viewer) => {
    const parsed = parse(z.object({ enabled: z.boolean(), accent: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable() }), input);
    if (!parsed.success) return parsed.state;
    if (parsed.data.enabled) {
      const sub = await db.subscription.findFirst({
        where: { userId: viewer.id, product: "PREMIUM_PORTFOLIO", status: { in: ["ACTIVE", "TRIALING"] }, currentPeriodEnd: { gt: new Date() } },
      });
      if (!sub) return fail("@msg.portfolioNeeds");
    }
    await db.profile.update({ where: { id: viewer.profileId }, data: { portfolioEnabled: parsed.data.enabled, portfolioAccent: parsed.data.accent } });
    revalidatePath(`/${viewer.username}`);
    return { ok: true, message: parsed.data.enabled ? "@msg.portfolioOn" : "@msg.portfolioOff" };
  });
}
