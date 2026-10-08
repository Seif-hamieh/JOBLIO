import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { LOCALE_COOKIE, LOCALE_META, fromAcceptLanguage, isLocale, type Locale } from "@/i18n/config";
import { createT, type TKey } from "@/i18n/translate";
import type { Metadata } from "next";
import { makeFormat } from "@/i18n/format";

/** The request's locale: explicit cookie choice, else the browser's language. */
export const getLocale = cache(async (): Promise<Locale> => {
  const c = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(c)) return c;
  return fromAcceptLanguage((await headers()).get("accept-language"));
});

/** `export const generateMetadata = pageTitle("nav.home")` — a translated document title. */
export function pageTitle(key: TKey) {
  return async (): Promise<Metadata> => ({ title: (await getI18n()).t(key) });
}

/** Translator + locale-aware formatters for server components. */
export const getI18n = cache(async () => {
  const locale = await getLocale();
  return { locale, dir: LOCALE_META[locale].dir, t: createT(locale), f: makeFormat(locale) };
});
