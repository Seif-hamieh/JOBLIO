import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import type { UserIntent } from "@/lib/constants";

// Data Access Layer: every server component, action and route handler gets
// the current user through these helpers, so authorization lives in one place.

export const getAuthSession = cache(async () => auth.api.getSession({ headers: await headers() }));

export type ViewerCompany = {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  role: "OWNER" | "ADMIN" | "RECRUITER";
};

export type Viewer = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
  username: string;
  intent: UserIntent;
  isAdmin: boolean;
  onboardedAt: Date | null;
  profileId: string;
  headline: string | null;
  openToWork: boolean;
  boosted: boolean;
  company: ViewerCompany | null;
  recruiterPro: boolean;
};

export const getViewer = cache(async (): Promise<Viewer | null> => {
  const session = await getAuthSession();
  if (!session) return null;
  const now = new Date();
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      emailVerified: true,
      image: true,
      username: true,
      intent: true,
      platformRole: true,
      bannedAt: true,
      onboardedAt: true,
      profile: { select: { id: true, headline: true, openToWork: true, featuredUntil: true } },
      companyMemberships: {
        take: 1,
        orderBy: { createdAt: "asc" },
        select: { role: true, company: { select: { id: true, slug: true, name: true, logoUrl: true } } },
      },
      subscriptions: {
        where: { product: "RECRUITER_PRO", status: { in: ["ACTIVE", "TRIALING"] }, currentPeriodEnd: { gt: now } },
        select: { id: true },
        take: 1,
      },
    },
  });
  // A banned member counts as signed out, even while a cached session cookie lasts (up to 5 minutes).
  if (!user || user.bannedAt || !user.profile || !user.username) return null;
  const membership = user.companyMemberships[0];
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    emailVerified: user.emailVerified,
    image: user.image,
    username: user.username,
    intent: user.intent,
    isAdmin: user.platformRole === "ADMIN",
    onboardedAt: user.onboardedAt,
    profileId: user.profile.id,
    headline: user.profile.headline,
    openToWork: user.profile.openToWork,
    boosted: !!user.profile.featuredUntil && user.profile.featuredUntil > now,
    company: membership ? { ...membership.company, role: membership.role } : null,
    recruiterPro: user.subscriptions.length > 0,
  };
});

/** For pages: redirects signed-out users to /login and new users to onboarding. */
export async function requireViewer(opts: { allowUnonboarded?: boolean } = {}) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  if (!opts.allowUnonboarded && !viewer.onboardedAt) redirect("/onboarding");
  return viewer;
}

/** For admin pages: non-admins get a plain 404, so the panel's existence isn't revealed. */
export async function requireAdmin() {
  const viewer = await requireViewer();
  if (!viewer.isAdmin) notFound();
  return viewer;
}

export type RecruiterViewer = Viewer & { company: ViewerCompany };

/** For recruiter pages: requires membership of a company. */
export async function requireRecruiter(): Promise<RecruiterViewer> {
  const viewer = await requireViewer();
  if (!viewer.company) redirect("/recruiter/setup");
  return viewer as RecruiterViewer;
}

export function canManageCompany(viewer: Viewer, companyId: string) {
  return viewer.company?.id === companyId && (viewer.company.role === "OWNER" || viewer.company.role === "ADMIN");
}
