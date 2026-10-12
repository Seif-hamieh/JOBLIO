"use client";

import { createContext, use, useMemo, type ReactNode } from "react";
import { LOCALE_META, type Locale } from "@/i18n/config";
import { createT } from "@/i18n/translate";
import { adoptDisplayNames, makeFormat, type DisplayNames } from "@/i18n/format";

const I18nContext = createContext<Locale>("en");

export function I18nProvider({ locale, names, children }: { locale: Locale; names?: DisplayNames; children: ReactNode }) {
  // Use the server's country/language names so hydration sees identical text.
  adoptDisplayNames(locale, names);
  return <I18nContext value={locale}>{children}</I18nContext>;
}

/** Translator + formatters for client components. */
export function useI18n() {
  const locale = use(I18nContext);
  return useMemo(() => ({ locale, dir: LOCALE_META[locale].dir, t: createT(locale), f: makeFormat(locale) }), [locale]);
}
