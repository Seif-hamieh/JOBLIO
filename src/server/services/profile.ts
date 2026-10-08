import "server-only";
import { db } from "@/server/db";
import { profileCompleteness } from "@/lib/profile-completeness";
import { computeYearsExperience, highestEducation } from "@/lib/profile-derived";
import { checkAchievements } from "@/server/services/achievements";

/**
 * Recomputes denormalised profile fields used by search and matching.
 * Call after any change to experiences, educations, skills or profile basics.
 */
export async function refreshProfileDerived(profileId: string) {
  const p = await db.profile.findUnique({
    where: { id: profileId },
    select: {
      userId: true,
      headline: true,
      about: true,
      city: true,
      desiredTitles: true,
      preferredWorkModes: true,
      user: { select: { image: true } },
      experiences: { select: { startDate: true, endDate: true, isCurrent: true, employmentType: true } },
      educations: { select: { level: true, endDate: true } },
      _count: { select: { skills: true, projects: true, languages: true, socialLinks: true } },
    },
  });
  if (!p) return;
  const { score } = profileCompleteness({
    hasPhoto: !!p.user.image,
    headline: p.headline,
    about: p.about,
    city: p.city,
    skillCount: p._count.skills,
    experienceCount: p.experiences.length,
    educationCount: p.educations.length,
    projectCount: p._count.projects,
    languageCount: p._count.languages,
    desiredTitles: p.desiredTitles,
    preferredWorkModes: p.preferredWorkModes,
    socialLinkCount: p._count.socialLinks,
  });
  await db.profile.update({
    where: { id: profileId },
    data: {
      yearsExperience: computeYearsExperience(p.experiences),
      educationLevel: highestEducation(p.educations),
      completeness: score,
    },
  });
  await checkAchievements(p.userId, ["PROFILE_COMPLETE", "VERIFIED_PROFESSIONAL"]);
}

export async function isConnected(a: string, b: string) {
  if (a === b) return true;
  const c = await db.connection.findFirst({
    where: {
      status: "ACCEPTED",
      OR: [
        { requesterId: a, addresseeId: b },
        { requesterId: b, addresseeId: a },
      ],
    },
    select: { id: true },
  });
  return !!c;
}

export async function isBlockedEitherWay(a: string, b: string) {
  const block = await db.block.findFirst({
    where: { OR: [{ blockerId: a, blockedId: b }, { blockerId: b, blockedId: a }] },
    select: { blockerId: true },
  });
  return !!block;
}

/** Applies the recipient's "who can message me" setting. Existing conversations stay open. */
export async function canMessageUser(sender: { id: string; isRecruiter: boolean }, recipientId: string) {
  if (sender.id === recipientId) return false;
  if (await isBlockedEitherWay(sender.id, recipientId)) return false;
  const recipient = await db.profile.findUnique({ where: { userId: recipientId }, select: { messagePermission: true } });
  if (!recipient) return false;
  if (recipient.messagePermission === "EVERYONE") return true;
  if (recipient.messagePermission === "RECRUITERS_AND_CONNECTIONS" && sender.isRecruiter) return true;
  if (await isConnected(sender.id, recipientId)) return true;
  const directKey = [sender.id, recipientId].sort().join(":");
  return !!(await db.conversation.findUnique({ where: { directKey }, select: { id: true } }));
}

/** Applies the profile owner's visibility setting for a given viewer. */
export async function canViewProfile(
  ownerId: string,
  visibility: "PUBLIC" | "MEMBERS" | "CONNECTIONS",
  viewerId: string | null,
) {
  if (viewerId === ownerId) return true;
  if (viewerId && (await isBlockedEitherWay(ownerId, viewerId))) return false;
  if (visibility === "PUBLIC") return true;
  if (!viewerId) return false;
  if (visibility === "MEMBERS") return true;
  return isConnected(ownerId, viewerId);
}
