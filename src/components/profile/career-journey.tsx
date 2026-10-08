"use client";

import { AnimatePresence, m } from "motion/react";
import { useMemo, useState } from "react";
import { Briefcase, FolderGit2, GraduationCap, Rocket } from "lucide-react";
import { Chip } from "@/components/ui/controls";
import { EASE_OUT } from "@/components/ui/motion";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/client";
import type { TKey } from "@/i18n/translate";

export type JourneyKind = "education" | "experience" | "project" | "current";

export type JourneyStep = {
  id: string;
  kind: JourneyKind;
  title: string;
  org?: string | null;
  period: string;
  description?: string | null;
  skills?: string[];
  /** Sort key (ms since epoch of the start date). */
  at: number;
};

const KIND = {
  education: { label: "profile.kindEducation", icon: GraduationCap, color: "var(--aurora)", soft: "bg-aurora-soft text-aurora-fg" },
  experience: { label: "profile.kindExperience", icon: Briefcase, color: "var(--brand)", soft: "bg-brand-soft text-brand-soft-fg" },
  project: { label: "profile.kindProject", icon: FolderGit2, color: "var(--ember)", soft: "bg-ember-soft text-ember-fg" },
  current: { label: "profile.kindNow", icon: Rocket, color: "var(--mint)", soft: "bg-mint-soft text-mint-fg" },
} as const;

const FILTERS: { value: JourneyKind | "all"; label: TKey }[] = [
  { value: "all", label: "profile.journeyFilterAll" },
  { value: "education", label: "profile.education" },
  { value: "experience", label: "profile.experience" },
  { value: "project", label: "profile.projects" },
];

/**
 * Interactive career timeline: Education → Experience → Projects → Current.
 * Horizontal track on desktop, vertical on mobile. Pure DOM + motion, so it
 * stays fast on every device.
 */
export function CareerJourney({ steps, compact }: { steps: JourneyStep[]; compact?: boolean }) {
  const { t, dir } = useI18n();
  const rtl = dir === "rtl";
  const [filter, setFilter] = useState<JourneyKind | "all">("all");
  const [active, setActive] = useState<string | null>(null);
  const sorted = useMemo(() => [...steps].sort((a, b) => a.at - b.at), [steps]);
  const visible = filter === "all" ? sorted : sorted.filter((s) => s.kind === filter || s.kind === "current");

  if (steps.length === 0) return null;

  return (
    <div>
      {!compact && (
        <div className="mb-6 flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <Chip key={f.value} selected={filter === f.value} onClick={() => setFilter(f.value)}>
              {t(f.label)}
            </Chip>
          ))}
        </div>
      )}

      {/* Desktop: horizontal track */}
      <div className="scrollbar-none relative hidden overflow-x-auto pb-2 md:block">
        <div className="relative flex min-w-full gap-0 px-2" style={{ width: Math.max(visible.length * 230, 600) }}>
          <m.div
            className="absolute start-6 end-6 top-1/2 h-[3px] rounded-full"
            style={{ transformOrigin: rtl ? "right" : "left", background: `linear-gradient(${rtl ? 270 : 90}deg, var(--aurora), var(--brand), var(--ember), var(--mint))` }}
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1.4, ease: EASE_OUT }}
          />
          <AnimatePresence mode="popLayout">
            {visible.map((s, i) => {
              const k = KIND[s.kind];
              const top = i % 2 === 0;
              const Icon = k.icon;
              return (
                <m.div
                  key={s.id}
                  layout
                  className={cn("relative flex w-[230px] shrink-0 flex-col items-center", compact ? "h-[300px]" : "h-[360px]")}
                  initial={{ opacity: 0, y: top ? -16 : 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.55, delay: 0.15 + i * 0.08, ease: EASE_OUT }}
                >
                  <button
                    type="button"
                    onClick={() => setActive(active === s.id ? null : s.id)}
                    className={cn(
                      "surface surface-hover absolute w-[210px] p-3.5 text-start",
                      top ? "bottom-[calc(50%+28px)]" : "top-[calc(50%+28px)]",
                      active === s.id && "ring-2 ring-[var(--ring)]",
                    )}
                    aria-expanded={active === s.id}
                  >
                    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide", k.soft)}>
                      {t(k.label)}
                    </span>
                    <div className="mt-2 line-clamp-2 text-sm font-semibold leading-snug">{s.title}</div>
                    {s.org && <div className="truncate text-xs text-fg-muted">{s.org}</div>}
                    <div className="mt-1 text-[11px] text-fg-subtle">{s.period}</div>
                    <AnimatePresence initial={false}>
                      {active === s.id && (s.description || s.skills?.length) && (
                        <m.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                          {s.description && <p className="mt-2 line-clamp-4 text-xs text-fg-muted">{s.description}</p>}
                          {s.skills && s.skills.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {s.skills.slice(0, 5).map((sk) => (
                                <span key={sk} className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] text-fg-muted">
                                  {sk}
                                </span>
                              ))}
                            </div>
                          )}
                        </m.div>
                      )}
                    </AnimatePresence>
                  </button>
                  <span
                    className="absolute h-[10px] w-px bg-border-strong"
                    style={{ top: top ? "calc(50% - 28px)" : "calc(50% + 18px)" }}
                  />
                  <span
                    className="absolute top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full border-[3px] border-surface text-white shadow-card"
                    style={{ background: k.color }}
                  >
                    <Icon className="size-4" />
                    {s.kind === "current" && <span className="absolute inset-0 animate-[pulse-ring_2.4s_cubic-bezier(0.16,1,0.3,1)_infinite] rounded-full" style={{ background: k.color }} />}
                  </span>
                </m.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>

      {/* Mobile: vertical track */}
      <ol className="relative space-y-4 ps-10 md:hidden">
        <m.span
          className="absolute bottom-2 start-[15px] top-2 w-[3px] origin-top rounded-full"
          style={{ background: "linear-gradient(180deg, var(--aurora), var(--brand), var(--ember), var(--mint))" }}
          initial={{ scaleY: 0 }}
          whileInView={{ scaleY: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1.2, ease: EASE_OUT }}
        />
        {visible.map((s, i) => {
          const k = KIND[s.kind];
          const Icon = k.icon;
          return (
            <m.li
              key={s.id}
              className="relative"
              initial={{ opacity: 0, x: rtl ? 10 : -10 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, delay: i * 0.05, ease: EASE_OUT }}
            >
              <span className="absolute -start-10 top-3 grid size-8 place-items-center rounded-full border-[3px] border-surface text-white shadow-card" style={{ background: k.color }}>
                <Icon className="size-3.5" />
              </span>
              <div className="surface p-3.5">
                <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide", k.soft)}>{t(k.label)}</span>
                <div className="mt-1.5 text-sm font-semibold">{s.title}</div>
                {s.org && <div className="text-xs text-fg-muted">{s.org}</div>}
                <div className="mt-0.5 text-[11px] text-fg-subtle">{s.period}</div>
                {!compact && s.description && <p className="mt-2 line-clamp-3 text-xs text-fg-muted">{s.description}</p>}
              </div>
            </m.li>
          );
        })}
      </ol>
    </div>
  );
}
