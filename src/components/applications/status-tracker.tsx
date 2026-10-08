"use client";

import { m } from "motion/react";
import { Check, X } from "lucide-react";
import { APPLICATION_TRACK, type ApplicationStatus } from "@/lib/constants";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";

/**
 * Applied → Viewed → Shortlisted → Interview → Offer → Hired, with
 * "Not selected" / "Withdrawn" shown as a stop at the furthest stage reached.
 */
export function StatusTracker({ status, reached }: { status: ApplicationStatus; reached: ApplicationStatus[] }) {
  const { t } = useI18n();
  const stopped = status === "REJECTED" || status === "WITHDRAWN";
  const furthest = stopped
    ? Math.max(0, ...reached.filter((s) => APPLICATION_TRACK.includes(s)).map((s) => APPLICATION_TRACK.indexOf(s)))
    : APPLICATION_TRACK.indexOf(status);
  const pct = (furthest / (APPLICATION_TRACK.length - 1)) * 100;

  return (
    <div className="relative">
      <div className="absolute start-3 end-3 top-3 h-[3px] rounded-full bg-surface-3" />
      <m.div
        className={cn("absolute start-3 top-3 h-[3px] rounded-full", stopped ? "bg-fg-subtle/50" : "bg-gradient-to-r from-brand to-mint rtl:bg-gradient-to-l")}
        initial={{ width: 0 }}
        whileInView={{ width: `calc(${pct}% - ${(pct / 100) * 24}px)` }}
        viewport={{ once: true }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
      />
      <ol className="relative grid grid-cols-6">
        {APPLICATION_TRACK.map((s, i) => {
          const done = i <= furthest;
          const current = i === furthest;
          const isStop = stopped && current;
          return (
            <li key={s} className="flex flex-col items-center gap-1.5">
              <m.span
                initial={{ scale: 0.6, opacity: 0 }}
                whileInView={{ scale: 1, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.08 * i, type: "spring", stiffness: 400, damping: 20 }}
                className={cn(
                  "relative grid size-6 place-items-center rounded-full border-2 text-white",
                  isStop ? "border-danger bg-danger" : done ? "border-brand bg-brand" : "border-border-strong bg-surface",
                  current && !stopped && s !== "HIRED" && "ring-4 ring-brand/20",
                  s === "HIRED" && done && "border-mint bg-mint",
                )}
              >
                {isStop ? <X className="size-3" strokeWidth={3.5} /> : done ? <Check className="size-3" strokeWidth={3.5} /> : null}
              </m.span>
              <span className={cn("text-center text-[10.5px] font-medium leading-tight sm:text-xs", done ? "text-fg" : "text-fg-subtle")}>
                {t(`enums.applicationStatus.${isStop ? status : s}`)}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
