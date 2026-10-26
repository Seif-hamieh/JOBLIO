"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db";
import { fail, parse, withViewer, type ActionState } from "@/server/action";
import { LIMITS } from "@/server/rate-limit";
import type { Viewer } from "@/server/session";
import { refreshProfileDerived } from "@/server/services/profile";
import {
  addSkill,
  deleteCertificate,
  deleteEducation,
  deleteExperience,
  deleteProject,
  removeProfileImage,
  removeSkill,
  saveBasics,
  saveCertificate,
  saveEducation,
  saveExperience,
  saveProject,
  setProfileImage,
  storeProjectImage,
  updateSkill,
} from "@/server/services/profile-editing";
import { UploadError } from "@/server/storage";
import { removeResume, saveResume } from "@/server/services/resume";
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
  skillUpdateSchema,
  socialLinkSchema,
} from "@/lib/validation/profile";

// The saving rules live in services/profile-editing (shared with the mobile API); these actions validate the
// form and turn the result into a message.

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
    await saveBasics(viewer, parsed.data);
    return { ok: true, message: "@msg.profileUpdated" };
  });
}

export async function uploadProfileImageAction(form: FormData): Promise<ActionState<{ url: string }>> {
  return withViewer<{ url: string }>({ limit: LIMITS.upload }, async (viewer) => {
    const kind = z.enum(["avatar", "cover"]).parse(form.get("kind"));
    const file = form.get("file");
    if (!(file instanceof File)) return fail("@msg.chooseImage");
    try {
      const url = await setProfileImage(viewer, kind, file);
      return { ok: true, message: kind === "avatar" ? "@msg.photoUpdated" : "@msg.coverUpdated", data: { url } };
    } catch (e) {
      if (e instanceof UploadError) return fail(e.message);
      throw e;
    }
  });
}

export async function removeProfileImageAction(kind: "avatar" | "cover"): Promise<ActionState> {
  return withViewer({ limit: LIMITS.write }, async (viewer) => {
    await removeProfileImage(viewer, z.enum(["avatar", "cover"]).parse(kind));
    return { ok: true, message: "@msg.removed" };
  });
}

// ── CV ───────────────────────────────────────────────────────────────────

export async function uploadResumeAction(form: FormData): Promise<ActionState> {
  return withViewer({ limit: LIMITS.upload }, async (viewer) => {
    const file = form.get("file");
    if (!(file instanceof File)) return fail("@msg.uploadChoose");
    try {
      await saveResume(viewer.id, file);
      return done(viewer, "@msg.cvSaved");
    } catch (e) {
      if (e instanceof UploadError) return fail(e.message);
      throw e;
    }
  });
}

export async function removeResumeAction(): Promise<ActionState> {
  return withViewer({ limit: LIMITS.write }, async (viewer) => {
    await removeResume(viewer.id);
    return done(viewer, "@msg.cvRemoved");
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
    await saveExperience(viewer, parsed.data);
    return { ok: true, message: "@msg.saved" };
  });
}

export async function deleteExperienceAction(expId: string): Promise<ActionState> {
  return withViewer({ limit: LIMITS.write }, async (viewer) => {
    await deleteExperience(viewer, id.parse(expId));
    return { ok: true, message: "@msg.removed" };
  });
}

export async function upsertEducationAction(input: z.input<typeof educationSchema>): Promise<ActionState> {
  return withViewer({ limit: LIMITS.write }, async (viewer) => {
    const parsed = parse(educationSchema, input);
    if (!parsed.success) return parsed.state;
    await saveEducation(viewer, parsed.data);
    return { ok: true, message: "@msg.saved" };
  });
}

export async function deleteEducationAction(eduId: string): Promise<ActionState> {
  return withViewer({ limit: LIMITS.write }, async (viewer) => {
    await deleteEducation(viewer, id.parse(eduId));
    return { ok: true, message: "@msg.removed" };
  });
}

export async function upsertCertificateAction(input: z.input<typeof certificateSchema>): Promise<ActionState> {
  return withViewer({ limit: LIMITS.write }, async (viewer) => {
    const parsed = parse(certificateSchema, input);
    if (!parsed.success) return parsed.state;
    await saveCertificate(viewer, parsed.data);
    return { ok: true, message: "@msg.saved" };
  });
}

export async function deleteCertificateAction(certId: string): Promise<ActionState> {
  return withViewer({ limit: LIMITS.write }, async (viewer) => {
    await deleteCertificate(viewer, id.parse(certId));
    return { ok: true, message: "@msg.removed" };
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
    const userSkillId = await addSkill(viewer, parsed.data);
    return { ok: true, message: "@msg.skillAdded", data: { userSkillId } };
  });
}

export async function updateSkillAction(userSkillId: string, input: z.input<typeof skillUpdateSchema>): Promise<ActionState> {
  return withViewer({ limit: LIMITS.write }, async (viewer) => {
    const parsed = parse(skillUpdateSchema, input);
    if (!parsed.success) return parsed.state;
    await updateSkill(viewer, id.parse(userSkillId), parsed.data);
    return { ok: true, message: "@msg.saved" };
  });
}

export async function removeSkillAction(userSkillId: string): Promise<ActionState> {
  return withViewer({ limit: LIMITS.write }, async (viewer) => {
    await removeSkill(viewer, id.parse(userSkillId));
    return { ok: true, message: "@msg.skillRemoved" };
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
    await saveProject(viewer, parsed.data);
    return { ok: true, message: "@msg.projectSaved" };
  });
}

export async function deleteProjectAction(projectId: string): Promise<ActionState> {
  return withViewer({ limit: LIMITS.write }, async (viewer) => {
    await deleteProject(viewer, id.parse(projectId));
    return { ok: true, message: "@msg.projectRemoved" };
  });
}

export async function uploadProjectImageAction(form: FormData): Promise<ActionState<{ url: string }>> {
  return withViewer<{ url: string }>({ limit: LIMITS.upload }, async (viewer) => {
    const file = form.get("file");
    if (!(file instanceof File)) return fail("@msg.chooseImage");
    try {
      return { ok: true, data: { url: await storeProjectImage(viewer, file) } };
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
