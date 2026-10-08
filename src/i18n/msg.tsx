"use client";

import { useI18n } from "@/i18n/client";
import type { TKey, TVars } from "@/i18n/translate";

/**
 * Translated text for components that render in both server and client trees
 * (where neither `getI18n()` nor `useI18n()` alone would work).
 */
export function Msg({ k, vars }: { k: TKey; vars?: TVars }) {
  const { t } = useI18n();
  return <>{t(k, vars)}</>;
}
