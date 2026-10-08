"use client";

import { useState, useTransition } from "react";
import { m } from "motion/react";
import { ThumbsUp } from "lucide-react";
import { endorseSkillAction } from "@/server/actions/network";
import { LevelBars } from "@/components/skills/level-picker";
import { toast } from "@/components/ui/toast";
import type { SkillLevel } from "@/lib/constants";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";

export type SkillCardData = {
  id: string;
  name: string;
  slug: string;
  level: SkillLevel;
  years: number | null;
  endorsementCount: number;
  isTop: boolean;
  endorsedByViewer: boolean;
};

function EndorseButton({ skill, canEndorse }: { skill: SkillCardData; canEndorse: boolean }) {
  const { t } = useI18n();
  const [endorsed, setEndorsed] = useState(skill.endorsedByViewer);
  const [count, setCount] = useState(skill.endorsementCount);
  const [pending, start] = useTransition();
  if (!canEndorse) {
    return count > 0 ? (
      <span className="inline-flex items-center gap-1 text-xs text-fg-muted">
        <ThumbsUp className="size-3" /> {count}
      </span>
    ) : null;
  }
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await endorseSkillAction(skill.id);
          if (res?.ok && res.data) {
            setEndorsed(res.data.endorsed);
            setCount(res.data.count);
            if (res.data.endorsed) toast.success(t("skills.endorsed", { name: skill.name }));
          } else toast.error(res && !res.ok ? res.error : t("common.somethingWrong"));
        })
      }
      aria-pressed={endorsed}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium transition active:scale-95",
        endorsed ? "border-brand bg-brand-soft text-brand-soft-fg" : "border-border text-fg-muted hover:border-brand hover:text-brand-soft-fg",
      )}
    >
      <ThumbsUp className={cn("size-3", endorsed && "fill-current")} /> {count > 0 ? count : t("skills.endorse")}
    </button>
  );
}

/** Visual skill cards; top skills are highlighted. */
export function SkillCards({ skills, canEndorse }: { skills: SkillCardData[]; canEndorse: boolean }) {
  const { t, f } = useI18n();
  const top = skills.filter((s) => s.isTop);
  const rest = skills.filter((s) => !s.isTop);
  return (
    <div className="space-y-4">
      {top.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-3">
          {top.map((s, i) => (
            <m.div
              key={s.id}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06 }}
              className="relative overflow-hidden rounded-2xl border border-brand/20 bg-gradient-to-br from-brand-soft/80 to-surface p-4 rtl:bg-gradient-to-bl"
            >
              <div className="text-[10.5px] font-semibold uppercase tracking-wider text-brand-soft-fg">{t("skills.topSkill")}</div>
              <div className="mt-1 font-display font-semibold">{s.name}</div>
              <div className="mt-2 flex items-center justify-between">
                <span className="flex items-center gap-2 text-xs text-fg-muted">
                  <LevelBars level={s.level} /> {t(`enums.skillLevel.${s.level}`)}
                </span>
                <EndorseButton skill={s} canEndorse={canEndorse} />
              </div>
            </m.div>
          ))}
        </div>
      )}
      {rest.length > 0 && (
        <ul className="grid gap-2 sm:grid-cols-2">
          {rest.map((s) => (
            <li key={s.id} className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3.5 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{s.name}</div>
                <div className="mt-1 flex items-center gap-2 text-[11px] text-fg-subtle">
                  <LevelBars level={s.level} /> {t(`enums.skillLevel.${s.level}`)}
                  {s.years ? ` · ${f.years(s.years)}` : ""}
                </div>
              </div>
              <EndorseButton skill={s} canEndorse={canEndorse} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
