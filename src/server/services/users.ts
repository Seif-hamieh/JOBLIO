import "server-only";
import { randomInt } from "node:crypto";
import { db } from "@/server/db";
import { RESERVED_USERNAMES } from "@/lib/constants";
import { slugify } from "@/lib/utils";

export async function uniqueUsername(name: string) {
  const base = slugify(name).replace(/-/g, ".").slice(0, 24) || "member";
  const candidates = [base, ...Array.from({ length: 6 }, () => `${base}.${randomInt(10, 9999)}`)];
  for (const candidate of candidates) {
    if (RESERVED_USERNAMES.has(candidate)) continue;
    const taken = await db.user.findUnique({ where: { username: candidate }, select: { id: true } });
    if (!taken) return candidate;
  }
  return `${base}.${Date.now().toString(36)}`;
}

/** Runs once after Better Auth creates a user (any sign-up method). */
export async function provisionNewUser(userId: string, name: string) {
  const username = await uniqueUsername(name);
  await db.$transaction([
    db.user.update({ where: { id: userId }, data: { username } }),
    db.profile.upsert({ where: { userId }, update: {}, create: { userId } }),
    db.userSettings.upsert({ where: { userId }, update: {}, create: { userId } }),
  ]);
}
