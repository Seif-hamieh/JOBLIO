"use client";

import { animate, m, useInView, useReducedMotion, type HTMLMotionProps } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export const EASE_OUT = [0.16, 1, 0.3, 1] as const;

/** Fades/slides content in once it scrolls into view. */
export function Reveal({
  children,
  delay = 0,
  y = 16,
  className,
  as = "div",
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  as?: "div" | "section" | "li";
}) {
  const Comp = as === "section" ? m.section : as === "li" ? m.li : m.div;
  return (
    <Comp
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6, delay, ease: EASE_OUT }}
    >
      {children}
    </Comp>
  );
}

/** Staggered list container + item. */
export function Stagger({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return (
    <m.div
      className={className}
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05, delayChildren: delay } } }}
    >
      {children}
    </m.div>
  );
}

export function StaggerItem({ children, className, ...props }: HTMLMotionProps<"div">) {
  return (
    <m.div
      className={className}
      variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE_OUT } } }}
      {...props}
    >
      {children}
    </m.div>
  );
}

/** Counts up to `value` when scrolled into view. */
export function AnimatedNumber({
  value,
  duration = 1.4,
  format = (n: number) => Math.round(n).toLocaleString("en"),
  className,
}: {
  value: number;
  duration?: number;
  format?: (n: number) => string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const current = useRef(0);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(reduce ? value : 0);

  useEffect(() => {
    if (!inView) return;
    if (reduce) {
      current.current = value;
      setDisplay(value);
      return;
    }
    // Animate from wherever we are now, so value changes glide instead of restarting.
    const controls = animate(current.current, value, {
      duration: current.current === 0 ? duration : 0.5,
      ease: EASE_OUT,
      onUpdate: (v) => {
        current.current = v;
        setDisplay(v);
      },
    });
    return () => controls.stop();
  }, [inView, value, duration, reduce]);

  return (
    <span ref={ref} className={cn("tabular-nums", className)}>
      {format(display)}
    </span>
  );
}

/** Animated horizontal progress bar. */
export function ProgressBar({ value, className, tone = "brand" }: { value: number; className?: string; tone?: "brand" | "mint" | "ember" }) {
  return (
    <div className={cn("h-2 overflow-hidden rounded-full bg-surface-3", className)} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <m.div
        className={cn("h-full rounded-full", tone === "brand" && "bg-brand", tone === "mint" && "bg-mint", tone === "ember" && "bg-ember")}
        initial={{ width: 0 }}
        whileInView={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        viewport={{ once: true }}
        transition={{ duration: 0.9, ease: EASE_OUT }}
      />
    </div>
  );
}
