import "server-only";
import { db, type Prisma } from "@/server/db";
import { canViewProfile } from "@/server/services/profile";
import { notify } from "@/server/services/notifications";
import { k } from "@/i18n/message";
import { checkAchievements } from "@/server/services/achievements";

export const fullProfileSelect = {
  id: true,
  name: true,
  image: true,
  username: true,
  createdAt: true,
  emailVerified: true,
  achievements: { select: { code: true, awardedAt: true } },
  companyMemberships: { take: 1, select: { role: true, title: true, company: { select: { name: true, slug: true, logoUrl: true, brandColor: true } } } },
  profile: {
    select: {
      id: true,
      headline: true,
      about: true,
      coverUrl: true,
      city: true,
      countryCode: true,
      website: true,
      pronouns: true,
      openToWork: true,
      availability: true,
      yearsExperience: true,
      desiredTitles: true,
      preferredWorkModes: true,
      preferredEmploymentTypes: true,
      visibility: true,
      showConnections: true,
      messagePermission: true,
      profileViewCount: true,
      completeness: true,
      featuredUntil: true,
      portfolioEnabled: true,
      portfolioAccent: true,
      skills: {
        orderBy: { position: "asc" },
        select: { id: true, level: true, years: true, isTop: true, endorsementCount: true, skill: { select: { id: true, name: true, slug: true, category: true } } },
      },
      experiences: { orderBy: [{ isCurrent: "desc" }, { startDate: "desc" }], include: { company: { select: { slug: true, logoUrl: true, brandColor: true } } } },
      educations: { orderBy: { startDate: "desc" } },
      projects: { orderBy: [{ featured: "desc" }, { position: "asc" }], include: { skills: { select: { id: true, name: true, slug: true } } } },
      certificates: { orderBy: { issueDate: "desc" } },
      languages: true,
      portfolioItems: { orderBy: { position: "asc" } },
      socialLinks: true,
    },
  },
} satisfies Prisma.UserSelect;

export type FullProfile = Prisma.UserGetPayload<{ select: typeof fullProfileSelect }>;

export async function getProfilePage(username: string, viewerId: string | null) {
  const user = await db.user.findUnique({ where: { username: username.toLowerCase() }, select: fullProfileSelect });
  if (!user?.profile) return { status: "not-found" as const };
  const allowed = await canViewProfile(user.id, user.profile.visibility, viewerId);
  if (!allowed) return { status: "private" as const, user: { name: user.name, image: user.image, headline: user.profile.headline, visibility: user.profile.visibility } };
  return { status: "ok" as const, user };
}

/**
 * Records a profile view at most once per viewer per day and coalesces the
 * owner's notification. Members browsing privately are recorded anonymously.
 */
export async function recordProfileView(viewedId: string, viewer: { id: string; name: string; company: { name: string } | null } | null) {
  if (!viewer || viewer.id === viewedId) return;
  const since = new Date(Date.now() - 86_400_000);
  const recent = await db.profileView.findFirst({ where: { viewerId: viewer.id, viewedId, createdAt: { gte: since } }, select: { id: true } });
  if (recent) return;
  const settings = await db.profile.findUnique({ where: { userId: viewer.id }, select: { privateBrowsing: true } });
  const anonymous = !!settings?.privateBrowsing;
  await db.$transaction([
    db.profileView.create({ data: { viewerId: viewer.id, viewedId, anonymous } }),
    db.profile.update({ where: { userId: viewedId }, data: { profileViewCount: { increment: 1 } } }),
  ]);
  const unread = await db.notification.findFirst({ where: { userId: viewedId, type: "PROFILE_VIEW", readAt: null }, select: { id: true } });
  if (!unread) {
    await notify({
      userId: viewedId,
      actorId: anonymous ? null : viewer.id,
      type: "PROFILE_VIEW",
      title: anonymous ? k("notif.profileViewAnon") : viewer.company ? k("notif.profileViewRecruiter", { company: viewer.company.name }) : k("notif.profileView", { name: viewer.name }),
      href: "/profile/views",
    });
  }
  await checkAchievements(viewedId, ["RISING_TALENT"]);
}
