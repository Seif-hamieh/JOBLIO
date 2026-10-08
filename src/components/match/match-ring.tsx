"use client";

import { Msg } from "@/i18n/msg";
import { m, useInView, useReducedMotion } from "motion/react";
import { useRef } from "react";
import { matchTier } from "@/lib/matching/engine";
import { cn } from "@/lib/utils";
import { AnimatedNumber, EASE_OUT } from "@/components/ui/motion";

const TIER_COLOR = {
  excellent: "var(--mint)",
  strong: "var(--brand)",
  fair: "var(--aurora)",
  low: "var(--fg-subtle)",
} as const;

/** Circular match score, e.g. "92% match". Animates when it scrolls into view. */
export function MatchRing({
  score,
  size = 56,
  stroke = 5,
  showLabel = true,
  className,
}: {
  score: number;
  size?: number;
  stroke?: number;
  showLabel?: boolean;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const color = TIER_COLOR[matchTier(score)];
  const target = c * (1 - score / 100);
  return (
    <div ref={ref} className={cn("relative inline-grid shrink-0 place-items-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
        <m.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: reduce ? target : c }}
          animate={{ strokeDashoffset: inView || reduce ? target : c }}
          style={{ transition: "stroke 0.4s" }}
          transition={{ duration: 1.1, ease: EASE_OUT }}
        />
      </svg>
      {showLabel && (
        <span className="absolute inset-0 grid place-items-center">
          <span className="font-display font-semibold leading-none" style={{ fontSize: size * 0.26 }}>
            <AnimatedNumber value={score} />
            <span style={{ fontSize: size * 0.16 }}>%</span>
          </span>
        </span>
      )}
      <span className="sr-only"><Msg k="match.pct" vars={{ n: score }} /></span>
    </div>
  );
}

/** Compact pill version for dense lists. */
export function MatchPill({ score, className }: { score: number; className?: string }) {
  const tier = matchTier(score);
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-xs font-semibold",
        tier === "excellent" && "bg-mint-soft text-mint-fg",
        tier === "strong" && "bg-brand-soft text-brand-soft-fg",
        tier === "fair" && "bg-aurora-soft text-aurora-fg",
        tier === "low" && "bg-surface-3 text-fg-muted",
        className,
      )}
    >
      <span className="size-1.5 rounded-full" style={{ background: TIER_COLOR[tier] }} />
      <Msg k="match.pct" vars={{ n: score }} />
    </span>
  );
}
