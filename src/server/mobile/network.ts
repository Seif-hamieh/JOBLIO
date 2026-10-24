import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { renderNotification } from "@/server/services/notifications";
import { createT } from "@/i18n/translate";

// What the mobile API returns for people (network lists) and notifications (explicit fields, as in dto.ts).

const en = createT("en");

type PersonRow = {
  id: string;
  name: string;
  image: string | null;
  username: string | null;
  profile: { headline: string | null; city: string | null; countryCode: string | null; openToWork: boolean; skills: { skill: { name: string } }[] } | null;
};

export function toPerson(u: PersonRow) {
  return {
    id: u.id,
    name: u.name,
    image: u.image,
    username: u.username,
    headline: u.profile?.headline ?? null,
    city: u.profile?.city ?? null,
    countryCode: u.profile?.countryCode ?? null,
    openToWork: u.profile?.openToWork ?? false,
    topSkills: u.profile?.skills.map((s) => s.skill.name) ?? [],
  };
}

type NotificationRow = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  titleKey: string | null;
  bodyKey: string | null;
  vars: Prisma.JsonValue;
  href: string | null;
  readAt: Date | null;
  createdAt: Date;
  actor: { name: string; image: string | null } | null;
};

/** A notification in English (the app's language). `href` is the website path; the app maps it to a screen. */
export function toNotification(n: NotificationRow) {
  const text = renderNotification(en, n);
  return {
    id: n.id,
    type: n.type,
    title: text.title,
    body: text.body,
    href: n.href,
    read: !!n.readAt,
    createdAt: n.createdAt.toISOString(),
    actor: n.actor ? { name: n.actor.name, image: n.actor.image } : null,
  };
}
