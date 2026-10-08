"use client";

import { createContext, use, useMemo, type ReactNode } from "react";
import { LOCALE_META, type Locale } from "@/i18n/config";
import { createT } from "@/i18n/translate";
import { makeFormat } from "@/i18n/format";

const I18nContext = createContext<Locale>("en");

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <I18nContext value={locale}>{children}</I18nContext>;
}

/** Translator + formatters for client components. */
export function useI18n() {
  const locale = use(I18nContext);
  return useMemo(() => ({ locale, dir: LOCALE_META[locale].dir, t: createT(locale), f: makeFormat(locale) }), [locale]);
}
