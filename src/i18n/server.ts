import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { LOCALE_COOKIE, LOCALE_META, fromAcceptLanguage, isLocale, type Locale } from "@/i18n/config";
import { createT, type TKey } from "@/i18n/translate";
import type { Metadata } from "next";
import { makeFormat, type DisplayNames } from "@/i18n/format";
import { COUNTRY_CODES, LANGUAGE_CODES } from "@/lib/geo";

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

const namesCache = new Map<Locale, DisplayNames>();

/** Country and language names for this locale, sent to the client so both sides render the same text. */
export function displayNames(locale: Locale): DisplayNames {
  let names = namesCache.get(locale);
  if (!names) {
    const f = makeFormat(locale);
    names = {
      regions: Object.fromEntries(COUNTRY_CODES.map((c) => [c, f.country(c)])),
      languages: Object.fromEntries(LANGUAGE_CODES.map((c) => [c, f.language(c)])),
    };
    namesCache.set(locale, names);
  }
  return names;
}
