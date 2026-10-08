"use server";

import { cookies } from "next/headers";
import { refresh } from "next/cache";
import { LOCALE_COOKIE, isLocale } from "@/i18n/config";
import { getViewer } from "@/server/session";
import { db } from "@/server/db";

/**
 * Stores the chosen language for a year. Works for signed-out visitors too;
 * for members it is also saved to their settings so emails and live
 * notifications use the same language.
 */
export async function setLocaleAction(locale: string) {
  if (!isLocale(locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax", httpOnly: false });
  const viewer = await getViewer();
  if (viewer) {
    await db.userSettings.upsert({ where: { userId: viewer.id }, create: { userId: viewer.id, locale }, update: { locale } });
  }
  refresh();
}
