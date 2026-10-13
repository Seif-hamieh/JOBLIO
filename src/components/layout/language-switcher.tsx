"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Languages } from "lucide-react";
import { LOCALES, LOCALE_META, type Locale } from "@/i18n/config";
import { useI18n } from "@/i18n/client";
import { setLocaleAction } from "@/server/actions/locale";
import { cn } from "@/lib/utils";

function useSwitch() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const go = (l: Locale) =>
    start(async () => {
      await setLocaleAction(l);
      router.refresh();
    });
  return { go, pending };
}

/** Compact toggle for nav bars: shows the *other* language. */
export function LanguageToggle({ className }: { className?: string }) {
  const { locale, t } = useI18n();
  const { go, pending } = useSwitch();
  const other: Locale = locale === "en" ? "ar" : "en";
  return (
    <button
      type="button"
      onClick={() => go(other)}
      disabled={pending}
      lang={other}
      className={cn("inline-flex h-11 items-center gap-1.5 rounded-full px-2.5 text-sm font-medium md:h-9 text-fg-muted transition hover:bg-surface-2 hover:text-fg disabled:opacity-60", className)}
      aria-label={`${t("common.language")}: ${LOCALE_META[other].label}`}
    >
      <Languages className="size-[18px]" />
      <span className={other === "ar" ? "font-arabic" : ""}>{other === "ar" ? "عربي" : "EN"}</span>
    </button>
  );
}

/** Full selector for settings. */
export function LanguageSelect() {
  const { locale } = useI18n();
  const { go, pending } = useSwitch();
  return (
    <div className="grid grid-cols-2 gap-2">
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          disabled={pending}
          onClick={() => go(l)}
          className={cn(
            "rounded-2xl border p-4 text-sm font-medium transition",
            locale === l ? "border-brand bg-brand-soft text-brand-soft-fg" : "border-border hover:border-border-strong",
          )}
        >
          {LOCALE_META[l].label}
        </button>
      ))}
    </div>
  );
}
