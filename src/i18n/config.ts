export const LOCALES = ["en", "ar"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "joblio-locale";

export const LOCALE_META: Record<Locale, { label: string; dir: "ltr" | "rtl"; intl: string }> = {
  en: { label: "English", dir: "ltr", intl: "en" },
  // Latin digits keep numbers, salaries and match scores consistent across languages.
  ar: { label: "العربية", dir: "rtl", intl: "ar-u-nu-latn" },
};

export function isLocale(v: unknown): v is Locale {
  return typeof v === "string" && (LOCALES as readonly string[]).includes(v);
}

/** Picks the best supported locale from an Accept-Language header. */
export function fromAcceptLanguage(header: string | null | undefined): Locale {
  if (!header) return DEFAULT_LOCALE;
  for (const part of header.split(",")) {
    const tag = part.split(";")[0]!.trim().toLowerCase();
    const base = tag.split("-")[0];
    if (isLocale(base)) return base;
  }
  return DEFAULT_LOCALE;
}
