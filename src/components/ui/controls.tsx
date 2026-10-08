"use client";

import { Switch as RSwitch, Tooltip as RTooltip } from "radix-ui";
import { m } from "motion/react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useId, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Switch({
  checked,
  onCheckedChange,
  name,
  defaultChecked,
  disabled,
  label,
  description,
}: {
  checked?: boolean;
  onCheckedChange?: (v: boolean) => void;
  name?: string;
  defaultChecked?: boolean;
  disabled?: boolean;
  label?: ReactNode;
  description?: ReactNode;
}) {
  const id = useId();
  const control = (
    <RSwitch.Root
      id={id}
      name={name}
      checked={checked}
      defaultChecked={defaultChecked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      value="on"
      className="relative h-6 w-11 shrink-0 rounded-full bg-surface-3 transition-colors duration-200 data-[state=checked]:bg-brand disabled:opacity-50"
    >
      <RSwitch.Thumb className="block size-5 translate-x-0.5 rounded-full bg-white shadow-md transition-transform duration-200 ease-[var(--ease-spring)] data-[state=checked]:translate-x-[22px] rtl:-translate-x-0.5 rtl:data-[state=checked]:-translate-x-[22px]" />
    </RSwitch.Root>
  );
  if (!label) return control;
  return (
    <div className="flex items-start justify-between gap-4">
      <label htmlFor={id} className="cursor-pointer">
        <span className="block text-sm font-medium">{label}</span>
        {description && <span className="mt-0.5 block text-[13px] text-fg-muted">{description}</span>}
      </label>
      {control}
    </div>
  );
}

export function Tooltip({ content, children, side = "top" }: { content: ReactNode; children: ReactNode; side?: "top" | "bottom" | "left" | "right" }) {
  return (
    <RTooltip.Root delayDuration={250}>
      <RTooltip.Trigger asChild>{children}</RTooltip.Trigger>
      <RTooltip.Portal>
        <RTooltip.Content
          side={side}
          sideOffset={6}
          className="z-[70] max-w-xs rounded-lg bg-fg px-2.5 py-1.5 text-xs text-bg shadow-float [animation:menu-in_0.15s_ease-out]"
        >
          {content}
        </RTooltip.Content>
      </RTooltip.Portal>
    </RTooltip.Root>
  );
}

export const TooltipProvider = RTooltip.Provider;

/** Route tabs with an animated active indicator. */
export function NavTabs({ tabs, className, layoutId = "nav-tabs" }: { tabs: { href: string; label: ReactNode; count?: number; exact?: boolean }[]; className?: string; layoutId?: string }) {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const current = search ? `${pathname}?${search}` : pathname;
  return (
    <nav className={cn("scrollbar-none -mx-1 flex gap-1 overflow-x-auto px-1", className)}>
      {tabs.map((t) => {
        // Exact tabs with a query string must match it; plain exact tabs match the path alone.
        const active = t.exact
          ? t.href.includes("?")
            ? current === t.href
            : pathname === t.href && !tabs.some((o) => o.href.includes("?") && o.href.startsWith(`${pathname}?`) && current === o.href)
          : pathname === t.href || pathname.startsWith(`${t.href}/`);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "relative flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium transition-colors",
              active ? "text-fg" : "text-fg-muted hover:text-fg",
            )}
          >
            {active && (
              <m.span layoutId={layoutId} className="absolute inset-0 rounded-full bg-surface shadow-soft ring-1 ring-border" transition={{ type: "spring", stiffness: 500, damping: 38 }} />
            )}
            <span className="relative">{t.label}</span>
            {t.count != null && t.count > 0 && <span className="relative rounded-full bg-brand px-1.5 text-[10.5px] font-semibold text-brand-fg">{t.count}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

/** Segmented control for in-page choices. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  layoutId,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode }[];
  layoutId: string;
  className?: string;
}) {
  return (
    <div className={cn("inline-flex rounded-full bg-surface-2 p-1 ring-1 ring-border", className)} role="radiogroup">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn("relative h-8 rounded-full px-3.5 text-sm font-medium transition-colors", value === o.value ? "text-fg" : "text-fg-muted hover:text-fg")}
        >
          {value === o.value && (
            <m.span layoutId={layoutId} className="absolute inset-0 rounded-full bg-surface shadow-soft" transition={{ type: "spring", stiffness: 500, damping: 38 }} />
          )}
          <span className="relative">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

/** Toggle chip used in filter bars and multi-selects. */
export function Chip({ selected, onClick, children, className }: { selected?: boolean; onClick?: () => void; children: ReactNode; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition-all duration-200 active:scale-95",
        selected ? "border-brand bg-brand-soft text-brand-soft-fg" : "border-border bg-surface text-fg-muted hover:border-border-strong hover:text-fg",
        className,
      )}
    >
      {children}
    </button>
  );
}
