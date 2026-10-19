import { Msg } from "@/i18n/msg";
import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function Card({ className, children, hover, as: As = "div" }: { className?: string; children: ReactNode; hover?: boolean; as?: "div" | "section" | "article" | "li" }) {
  return <As className={cn("glass-card", hover && "surface-hover", className)}>{children}</As>;
}

export function CardHeader({ title, description, action, className }: { title: ReactNode; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <div className="min-w-0">
        <h3 className="font-display text-[15px] font-semibold">{title}</h3>
        {description && <p className="mt-0.5 text-sm text-fg-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        {eyebrow && <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-brand-soft-fg">{eyebrow}</div>}
        <h1 className="font-display text-2xl font-semibold sm:text-[28px]">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-[15px] text-fg-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("relative flex flex-col items-center overflow-hidden rounded-3xl border border-dashed border-border-strong px-6 py-14 text-center", className)}>
      <div className="bg-dots pointer-events-none absolute inset-0 opacity-60 [mask-image:radial-gradient(circle_at_center,black,transparent_70%)]" />
      {icon && (
        <div className="relative mb-4 grid size-14 place-items-center rounded-2xl bg-brand-soft text-brand-soft-fg shadow-soft [&_svg]:size-6">{icon}</div>
      )}
      <h3 className="relative font-display text-lg font-semibold">{title}</h3>
      {description && <p className="relative mt-1.5 max-w-sm text-sm text-fg-muted">{description}</p>}
      {action && <div className="relative mt-5">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} aria-hidden />;
}

export function Divider({ className, label }: { className?: string; label?: string }) {
  if (!label) return <hr className={cn("border-border", className)} />;
  return (
    <div className={cn("flex items-center gap-3 text-xs text-fg-subtle", className)}>
      <span className="h-px flex-1 bg-border" />
      {label}
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

export function Pagination({ page, pageCount, href }: { page: number; pageCount: number; href: (page: number) => string }) {
  if (pageCount <= 1) return null;
  const pages: (number | "…")[] = [];
  for (let i = 1; i <= pageCount; i++) {
    if (i === 1 || i === pageCount || Math.abs(i - page) <= 1) pages.push(i);
    else if (pages[pages.length - 1] !== "…") pages.push("…");
  }
  const btn = "inline-flex h-9 min-w-9 items-center justify-center rounded-xl px-2 text-sm transition-colors";
  return (
    <nav className="flex items-center justify-center gap-1" aria-label="pagination">
      {page > 1 ? (
        <Link href={href(page - 1)} className={cn(btn, "text-fg-muted hover:bg-surface-2")} >
          <span className="sr-only"><Msg k="common.previous" /></span>
          <ChevronLeft className="size-4" />
        </Link>
      ) : (
        <span className={cn(btn, "text-fg-subtle/50")}>
          <ChevronLeft className="size-4" />
        </span>
      )}
      {pages.map((p, i) =>
        p === "…" ? (
          <span key={`e${i}`} className="px-1 text-fg-subtle">
            …
          </span>
        ) : (
          <Link
            key={p}
            href={href(p)}
            aria-current={p === page ? "page" : undefined}
            className={cn(btn, p === page ? "bg-fg font-medium text-bg" : "text-fg-muted hover:bg-surface-2")}
          >
            {p}
          </Link>
        ),
      )}
      {page < pageCount ? (
        <Link href={href(page + 1)} className={cn(btn, "text-fg-muted hover:bg-surface-2")} >
          <span className="sr-only"><Msg k="common.nextPage" /></span>
          <ChevronRight className="size-4" />
        </Link>
      ) : (
        <span className={cn(btn, "text-fg-subtle/50")}>
          <ChevronRight className="size-4" />
        </span>
      )}
    </nav>
  );
}

export function Stat({ label, value, hint, icon, className }: { label: string; value: ReactNode; hint?: ReactNode; icon?: ReactNode; className?: string }) {
  return (
    <div className={cn("surface p-5", className)}>
      <div className="flex items-center justify-between text-sm text-fg-muted">
        {label}
        {icon && <span className="text-fg-subtle [&_svg]:size-4">{icon}</span>}
      </div>
      <div className="mt-2 font-display text-[28px] font-semibold leading-none tracking-tight">{value}</div>
      {hint && <div className="mt-2 text-xs text-fg-subtle">{hint}</div>}
    </div>
  );
}
