"use client";

import { useI18n } from "@/i18n/client";
import { SKILL_LEVELS, SKILL_RANK, type SkillLevel } from "@/lib/constants";
import { cn } from "@/lib/utils";

/** Four-step level selector rendered as filling bars. */
export function LevelPicker({ value, onChange, size = "md" }: { value: SkillLevel; onChange: (v: SkillLevel) => void; size?: "sm" | "md" }) {
  const { t } = useI18n();
  const label = (l: SkillLevel) => t(`enums.skillLevel.${l}`);
  return (
    <div className="flex items-center gap-2" role="radiogroup" aria-label={t("skills.levelAria")}>
      <div className="flex gap-1">
        {SKILL_LEVELS.map((l) => (
          <button
            key={l}
            type="button"
            role="radio"
            aria-checked={value === l}
            aria-label={label(l)}
            title={label(l)}
            onClick={() => onChange(l)}
            className={cn(
              "rounded-full transition-all duration-200 hover:scale-110",
              size === "sm" ? "h-2 w-4" : "h-2.5 w-5",
              SKILL_RANK[l] <= SKILL_RANK[value] ? "bg-brand" : "bg-surface-3 hover:bg-border-strong",
            )}
          />
        ))}
      </div>
      <span className={cn("w-[84px] text-fg-muted", size === "sm" ? "text-[11px]" : "text-xs")}>{label(value)}</span>
    </div>
  );
}

/** Read-only level indicator. */
export function LevelBars({ level, className }: { level: SkillLevel; className?: string }) {
  const { t } = useI18n();
  const label = t(`enums.skillLevel.${level}`);
  return (
    <span className={cn("inline-flex gap-0.5", className)} aria-label={label} title={label}>
      {SKILL_LEVELS.map((l) => (
        <span key={l} className={cn("h-1.5 w-3 rounded-full", SKILL_RANK[l] <= SKILL_RANK[level] ? "bg-brand" : "bg-surface-3")} />
      ))}
    </span>
  );
}
