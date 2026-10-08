"use client";

import { m } from "motion/react";
import { Check, Minus, X, Info } from "lucide-react";
import type { MatchResult } from "@/lib/matching/engine";
import { describeCriterion, describeHighlight } from "@/lib/matching/describe";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";
import { EASE_OUT } from "@/components/ui/motion";
import { MatchRing } from "@/components/match/match-ring";

const ICON = {
  met: <Check className="size-3.5" strokeWidth={3} />,
  partial: <Minus className="size-3.5" strokeWidth={3} />,
  missed: <X className="size-3.5" strokeWidth={3} />,
  na: <Info className="size-3.5" />,
};

const pts = (n: number) => n.toFixed(1).replace(/\.0$/, "");

/**
 * Shows exactly how a match percentage was calculated: every criterion, its
 * weight, the points earned and the rule-based reason.
 */
export function MatchBreakdown({ match, perspective = "seeker" }: { match: MatchResult; perspective?: "seeker" | "recruiter" }) {
  const { t, f, dir } = useI18n();
  const applicable = match.criteria.filter((c) => c.status !== "na");
  const na = match.criteria.filter((c) => c.status === "na");
  const possible = applicable.reduce((s, c) => s + c.weight, 0);
  const earned = applicable.reduce((s, c) => s + c.earned, 0);

  return (
    <div>
      <div className="flex items-center gap-4">
        <MatchRing score={match.score} size={72} stroke={6} />
        <div>
          <div className="font-display text-lg font-semibold">{t("match.pct", { n: match.score })}</div>
          <p className="text-sm text-fg-muted">{t("match.points", { earned: pts(earned), possible, n: applicable.length })}</p>
        </div>
      </div>

      <ul className="mt-5 space-y-2.5">
        {applicable.map((c, i) => (
          <m.li
            key={c.key}
            className="rounded-2xl border border-border bg-surface-2/50 p-3"
            initial={{ opacity: 0, x: dir === "rtl" ? 6 : -6 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.35, delay: i * 0.04, ease: EASE_OUT }}
          >
            <div className="flex items-center gap-2.5">
              <span
                className={cn(
                  "grid size-6 shrink-0 place-items-center rounded-full",
                  c.status === "met" && "bg-mint-soft text-mint-fg",
                  c.status === "partial" && "bg-ember-soft text-ember-fg",
                  c.status === "missed" && "bg-danger-soft text-danger-fg",
                )}
              >
                {ICON[c.status]}
              </span>
              <span className="text-sm font-medium">{t(`match.c.${c.key}`)}</span>
              <span className="ms-auto text-xs tabular-nums text-fg-muted">{t("common.pts", { earned: pts(c.earned), weight: c.weight })}</span>
            </div>
            <div className="mt-2 flex items-center gap-3 ps-8">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3">
                <m.div
                  className={cn("h-full rounded-full", c.status === "met" ? "bg-mint" : c.status === "partial" ? "bg-ember" : "bg-danger/60")}
                  initial={{ width: 0 }}
                  whileInView={{ width: `${(c.earned / c.weight) * 100}%` }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.7, delay: 0.1 + i * 0.04, ease: EASE_OUT }}
                />
              </div>
            </div>
            <p className="mt-1.5 ps-8 text-[13px] text-fg-muted">{describeCriterion(c, t, f)}</p>
          </m.li>
        ))}
      </ul>

      {(match.missingSkills.length > 0 || na.length > 0) && (
        <div className="mt-4 space-y-3 text-[13px] text-fg-muted">
          {match.missingSkills.length > 0 && (
            <p>
              <span className="font-medium text-fg">{perspective === "seeker" ? t("match.toStrengthen") : t("match.missing")}</span> {f.list(match.missingSkills)}
            </p>
          )}
          {na.length > 0 && (
            <p>
              <span className="font-medium text-fg">{t("match.notCounted")}</span>{" "}
              {na.map((c) => `${t(`match.c.${c.key}`)} (${describeCriterion(c, t, f)})`).join(" · ")}
            </p>
          )}
        </div>
      )}

      <p className="mt-4 rounded-xl bg-surface-2 px-3 py-2.5 text-xs leading-relaxed text-fg-subtle">
        {t("match.footer", { extra: perspective === "recruiter" ? t("match.footerAvail") : "" })}
      </p>
    </div>
  );
}

/** One-line reasons for list cards: ✓ 8 matching skills · ✓ Remote compatible. */
export function MatchHighlights({ match, className }: { match: MatchResult; className?: string }) {
  const { t, f } = useI18n();
  if (!match.highlights.length) return null;
  return (
    <ul className={cn("flex flex-wrap gap-x-3 gap-y-1 text-xs text-fg-muted", className)}>
      {match.highlights.slice(0, 4).map((h, i) => (
        <li key={i} className="inline-flex items-center gap-1">
          <Check className="size-3 text-mint" strokeWidth={3} />
          {describeHighlight(h, t, f)}
        </li>
      ))}
    </ul>
  );
}
