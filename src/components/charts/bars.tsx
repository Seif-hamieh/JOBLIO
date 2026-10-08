"use client";

import { m } from "motion/react";
import { cn } from "@/lib/utils";

/**
 * Minimal animated bar chart for small trend widgets. Values are labelled
 * for screen readers; hovering a bar shows its exact value.
 */
export function Bars({
  data,
  height = 72,
  className,
  tone = "brand",
  label,
}: {
  data: { label: string; value: number }[];
  height?: number;
  className?: string;
  tone?: "brand" | "mint" | "aurora";
  label: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const color = tone === "mint" ? "var(--mint)" : tone === "aurora" ? "var(--aurora)" : "var(--brand)";
  return (
    <figure className={cn("w-full", className)}>
      <div className="flex items-end gap-[3px]" style={{ height }} role="img" aria-label={`${label}: ${data.map((d) => `${d.label} ${d.value}`).join(", ")}`}>
        {data.map((d, i) => (
          <div key={d.label} className="group relative flex h-full flex-1 items-end">
            <m.div
              className="w-full rounded-t-[4px]"
              style={{ background: color, opacity: i === data.length - 1 ? 1 : 0.55 }}
              initial={{ height: 0 }}
              whileInView={{ height: `${Math.max(4, (d.value / max) * 100)}%` }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: i * 0.025, ease: [0.16, 1, 0.3, 1] }}
            />
            <span className="pointer-events-none absolute -top-7 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-fg px-1.5 py-0.5 text-[10px] text-bg group-hover:block">
              {d.label}: {d.value}
            </span>
          </div>
        ))}
      </div>
    </figure>
  );
}
