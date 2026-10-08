"use client";

import { useI18n } from "@/i18n/client";
import { Award, BadgeCheck, Compass, Network, Rocket, ShieldCheck, Sparkles, Zap } from "lucide-react";
import type { AchievementCode } from "@/lib/achievements";
import { cn } from "@/lib/utils";

const ICON: Record<AchievementCode, typeof Award> = {
  PROFILE_COMPLETE: BadgeCheck,
  VERIFIED_PROFESSIONAL: ShieldCheck,
  TOP_SKILL: Sparkles,
  RISING_TALENT: Rocket,
  FAST_APPLICANT: Zap,
  TOP_CANDIDATE: Award,
  CAREER_EXPLORER: Compass,
  NETWORK_BUILDER: Network,
};

const HUE: Record<AchievementCode, string> = {
  PROFILE_COMPLETE: "from-brand to-aurora",
  VERIFIED_PROFESSIONAL: "from-aurora to-mint",
  TOP_SKILL: "from-ember to-[oklch(0.7_0.17_35)]",
  RISING_TALENT: "from-[oklch(0.65_0.2_330)] to-brand",
  FAST_APPLICANT: "from-ember to-[oklch(0.8_0.15_95)]",
  TOP_CANDIDATE: "from-mint to-aurora",
  CAREER_EXPLORER: "from-aurora to-brand",
  NETWORK_BUILDER: "from-brand to-[oklch(0.65_0.2_330)]",
};

/** Subtle, professional achievement medallion. Locked ones are greyed out. */
export function AchievementBadge({ code, earned = true, size = "md", showLabel = true }: { code: AchievementCode; earned?: boolean; size?: "sm" | "md"; showLabel?: boolean }) {
  const { t } = useI18n();
  const Icon = ICON[code];
  const a = { title: t(`achievementsDef.${code}.title`), description: t(`achievementsDef.${code}.description`) };
  return (
    <div className="flex flex-col items-center gap-1.5 text-center" title={`${a.title} — ${a.description}`}>
      <span
        className={cn(
          "grid place-items-center rounded-2xl text-white shadow-card ring-1 ring-white/20",
          size === "sm" ? "size-10" : "size-14",
          earned ? `bg-gradient-to-br ${HUE[code]}` : "bg-surface-3 text-fg-subtle shadow-none",
        )}
      >
        <Icon className={size === "sm" ? "size-4" : "size-6"} />
      </span>
      {showLabel && <span className={cn("text-[11px] font-medium leading-tight", earned ? "text-fg" : "text-fg-subtle")}>{a.title}</span>}
    </div>
  );
}
