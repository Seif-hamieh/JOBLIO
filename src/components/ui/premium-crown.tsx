"use client";

import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";

/** The 👑 next to a premium member's name (an active premium plan or Profile Boost). */
export function PremiumCrown({ className }: { className?: string }) {
  const { t } = useI18n();
  return (
    <span role="img" aria-label={t("premiumBadge.label")} title={t("premiumBadge.label")} className={cn("inline-block select-none leading-none", className)}>
      👑
    </span>
  );
}
