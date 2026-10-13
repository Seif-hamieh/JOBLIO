import { Msg } from "@/i18n/msg";
import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

const TONES = {
  neutral: "bg-surface-2 text-fg-muted border-border",
  brand: "bg-brand-soft text-brand-soft-fg border-transparent",
  mint: "bg-mint-soft text-mint-fg border-transparent",
  aurora: "bg-aurora-soft text-aurora-fg border-transparent",
  ember: "bg-ember-soft text-ember-fg border-transparent",
  danger: "bg-danger-soft text-danger-fg border-transparent",
  outline: "bg-transparent text-fg-muted border-border-strong",
  solid: "bg-fg text-bg border-transparent",
} as const;

export type BadgeTone = keyof typeof TONES;

export function Badge({
  tone = "neutral",
  size = "sm",
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone; size?: "xs" | "sm" | "md" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full border font-medium [&_svg]:size-3",
        size === "xs" && "h-5 px-1.5 text-xs",
        size === "sm" && "h-6 px-2.5 text-xs",
        size === "md" && "h-7 px-3 text-[13px]",
        TONES[tone],
        className,
      )}
      {...props}
    />
  );
}

/** Pulsing "Open to Work" signal. */
export function OpenToWorkBadge({ className, label = <Msg k="prefs.openToWork" /> }: { className?: string; label?: ReactNode }) {
  return (
    <Badge tone="mint" className={className}>
      <span className="relative flex size-2">
        <span className="absolute inline-flex size-full animate-[pulse-ring_2.4s_cubic-bezier(0.16,1,0.3,1)_infinite] rounded-full bg-mint" />
        <span className="relative inline-flex size-2 rounded-full bg-mint" />
      </span>
      {label}
    </Badge>
  );
}
