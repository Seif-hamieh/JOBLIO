import "server-only";
import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { db } from "@/server/db";
import { ActionError } from "@/server/action";
import { refreshProfileDerived } from "@/server/services/profile";
import { deleteStored, storeUpload } from "@/server/storage";
import type { basicsSchema, certificateSchema, educationSchema, experienceSchema, projectSchema, skillEntrySchema, skillUpdateSchema } from "@/lib/validation/profile";

// Saving a member's own profile, shared by the website's profile actions and the mobile API. Input is already
// validated with the schemas in lib/validation/profile. Rule breaks throw ActionError with an encoded message key;
// upload problems throw UploadError (from storage).

export type ProfileOwner = { id: string; profileId: string; username: string };

/** Recomputes completeness / match data and refreshes the pages that show the profile. */
export async function afterProfileChange(owner: ProfileOwner) {
  await refreshProfileDerived(owner.profileId);
  revalidatePath(`/in/${owner.username}`);
  revalidatePath("/profile", "layout");
  revalidatePath("/home");
}

// ── Basics & photos ──────────────────────────────────────────────────────

export async function saveBasics(owner: ProfileOwner, data: z.output<typeof basicsSchema>) {
  const { name, phoneNumber, ...rest } = data;
  await db.$transaction([db.user.update({ where: { id: owner.id }, data: { name, ...(phoneNumber !== undefined && { phoneNumber }) } }), db.profile.update({ where: { id: owner.profileId }, data: rest })]);
  await afterProfileChange(owner);
}

async function currentProfileImage(owner: ProfileOwner, kind: "avatar" | "cover") {
  if (kind === "avatar") return (await db.user.findUnique({ where: { id: owner.id }, select: { image: true } }))?.image;
  return (await db.profile.findUnique({ where: { id: owner.profileId }, select: { coverUrl: true } }))?.coverUrl;
}

/** Stores a new photo or cover (checked by its real contents) and deletes the old file. Returns the new URL. */
export async function setProfileImage(owner: ProfileOwner, kind: "avatar" | "cover", file: File) {
  const old = await currentProfileImage(owner, kind);
  const stored = await storeUpload(file, kind, owner.id);
  if (kind === "avatar") await db.user.update({ where: { id: owner.id }, data: { image: stored.url } });
  else await db.profile.update({ where: { id: owner.profileId }, data: { coverUrl: stored.url } });
  await deleteStored([old]);
  await afterProfileChange(owner);
  return stored.url;
}

export async function removeProfileImage(owner: ProfileOwner, kind: "avatar" | "cover") {
  const old = await currentProfileImage(owner, kind);
  if (kind === "avatar") await db.user.update({ where: { id: owner.id }, data: { image: null } });
  else await db.profile.update({ where: { id: owner.profileId }, data: { coverUrl: null } });
  await deleteStored([old]);
  await afterProfileChange(owner);
}

// ── Experience / education / certificates ───────────────────────────────

export async function saveExperience(owner: ProfileOwner, input: z.output<typeof experienceSchema>) {
  const { id: expId, ...data } = input;
  // Link to a JOBLIO company page when the name matches exactly.
  const company = await db.company.findFirst({ where: { name: { equals: data.companyName, mode: "insensitive" }, importSource: null }, select: { id: true } });
  const row = { ...data, endDate: data.isCurrent ? null : data.endDate, companyId: company?.id ?? null };
  if (expId) {
    const updated = await db.experience.updateMany({ where: { id: expId, profileId: owner.profileId }, data: row });
    if (!updated.count) throw new ActionError("@msg.expNotFound");
  } else {
    if ((await db.experience.count({ where: { profileId: owner.profileId } })) >= 40) throw new ActionError("@msg.maxRoles");
    await db.experience.create({ data: { ...row, profileId: owner.profileId } });
  }
  await afterProfileChange(owner);
}

export async function deleteExperience(owner: ProfileOwner, expId: string) {
  await db.experience.deleteMany({ where: { id: expId, profileId: owner.profileId } });
  await afterProfileChange(owner);
}

export async function saveEducation(owner: ProfileOwner, input: z.output<typeof educationSchema>) {
  const { id: eduId, ...data } = input;
  if (eduId) {
    const updated = await db.education.updateMany({ where: { id: eduId, profileId: owner.profileId }, data });
    if (!updated.count) throw new ActionError("@msg.eduNotFound");
  } else {
    if ((await db.education.count({ where: { profileId: owner.profileId } })) >= 20) throw new ActionError("@msg.maxEdu");
    await db.education.create({ data: { ...data, profileId: owner.profileId } });
  }
  await afterProfileChange(owner);
}

export async function deleteEducation(owner: ProfileOwner, eduId: string) {
  await db.education.deleteMany({ where: { id: eduId, profileId: owner.profileId } });
  await afterProfileChange(owner);
}

export async function saveCertificate(owner: ProfileOwner, input: z.output<typeof certificateSchema>) {
  const { id: certId, ...data } = input;
  if (certId) {
    const updated = await db.certificate.updateMany({ where: { id: certId, profileId: owner.profileId }, data });
    if (!updated.count) throw new ActionError("@msg.certNotFound");
  } else {
    if ((await db.certificate.count({ where: { profileId: owner.profileId } })) >= 30) throw new ActionError("@msg.maxCerts");
    await db.certificate.create({ data: { ...data, profileId: owner.profileId } });
  }
  await afterProfileChange(owner);
}

export async function deleteCertificate(owner: ProfileOwner, certId: string) {
  await db.certificate.deleteMany({ where: { id: certId, profileId: owner.profileId } });
  await afterProfileChange(owner);
}

// ── Skills ───────────────────────────────────────────────────────────────

export async function addSkill(owner: ProfileOwner, input: z.output<typeof skillEntrySchema>) {
  const skill = await db.skill.findUnique({ where: { id: input.skillId }, select: { id: true } });
  if (!skill) throw new ActionError("@msg.unknownSkill");
  const count = await db.userSkill.count({ where: { profileId: owner.profileId } });
  if (count >= 50) throw new ActionError("@msg.maxSkills");
  const us = await db.userSkill.upsert({
    where: { profileId_skillId: { profileId: owner.profileId, skillId: skill.id } },
    create: { profileId: owner.profileId, skillId: skill.id, level: input.level, position: count },
    update: { level: input.level },
  });
  await db.skill.update({ where: { id: skill.id }, data: { usageCount: { increment: 1 } } });
  await afterProfileChange(owner);
  return us.id;
}

export async function updateSkill(owner: ProfileOwner, userSkillId: string, data: z.output<typeof skillUpdateSchema>) {
  if (data.isTop) {
    const tops = await db.userSkill.count({ where: { profileId: owner.profileId, isTop: true, id: { not: userSkillId } } });
    if (tops >= 3) throw new ActionError("@msg.maxTop");
  }
  const updated = await db.userSkill.updateMany({ where: { id: userSkillId, profileId: owner.profileId }, data });
  if (!updated.count) throw new ActionError("@msg.skillNotFound");
  await afterProfileChange(owner);
}

export async function removeSkill(owner: ProfileOwner, userSkillId: string) {
  await db.userSkill.deleteMany({ where: { id: userSkillId, profileId: owner.profileId } });
  await afterProfileChange(owner);
}

// ── Projects ─────────────────────────────────────────────────────────────

export async function saveProject(owner: ProfileOwner, input: z.output<typeof projectSchema>) {
  const { id: projectId, skillIds, imageUrl, ...data } = input;
  // Only accept images uploaded through our own storage.
  const image = imageUrl && (imageUrl.startsWith("/api/v1/files/public/project/") || imageUrl.startsWith("/media/")) ? imageUrl : null;
  const skills = (await db.skill.findMany({ where: { id: { in: skillIds } }, select: { id: true } })).map((s) => ({ id: s.id }));
  if (projectId) {
    const existing = await db.project.findFirst({ where: { id: projectId, profileId: owner.profileId }, select: { id: true, imageUrl: true } });
    if (!existing) throw new ActionError("@msg.projectNotFound");
    await db.project.update({ where: { id: projectId }, data: { ...data, featured: !!data.featured, imageUrl: image, skills: { set: skills } } });
    if (existing.imageUrl !== image) await deleteStored([existing.imageUrl]);
  } else {
    const count = await db.project.count({ where: { profileId: owner.profileId } });
    if (count >= 30) throw new ActionError("@msg.maxProjects");
    await db.project.create({ data: { ...data, featured: !!data.featured, imageUrl: image, profileId: owner.profileId, position: count, skills: { connect: skills } } });
  }
  await afterProfileChange(owner);
}

export async function deleteProject(owner: ProfileOwner, projectId: string) {
  const project = await db.project.findFirst({ where: { id: projectId, profileId: owner.profileId }, select: { id: true, imageUrl: true } });
  if (project) {
    await db.project.delete({ where: { id: project.id } });
    await deleteStored([project.imageUrl]);
  }
  await afterProfileChange(owner);
}

/** Stores a project image; it is attached when the project is saved. */
export async function storeProjectImage(owner: ProfileOwner, file: File) {
  return (await storeUpload(file, "project", owner.id)).url;
}
