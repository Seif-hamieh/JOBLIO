import Link from "next/link";
import { cn } from "@/lib/utils";

/** The JOBLIO mark: a "J" whose stem rises into a brand-violet arrow — the next step up in a career. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={cn("size-8", className)} aria-hidden>
      <path d="M27 6v17a8.5 8.5 0 0 1-17 0v-4" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
      <path d="M10 9.5 4.8 17.8h10.4Z" fill="var(--brand)" stroke="var(--brand)" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo({ href = "/", className, compact }: { href?: string; className?: string; compact?: boolean }) {
  return (
    <Link href={href} className={cn("group inline-flex items-center gap-2", className)} aria-label="JOBLIO">
      <LogoMark className="transition-transform duration-500 ease-[var(--ease-spring)] group-hover:-translate-y-0.5" />
      {!compact && <span className="font-display text-[20px] font-extrabold tracking-[-0.05em]">joblio</span>}
    </Link>
  );
}
