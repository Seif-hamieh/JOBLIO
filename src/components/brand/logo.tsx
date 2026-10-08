import Link from "next/link";
import { cn } from "@/lib/utils";

/** The JOBLIO mark: a "J" drawn as a connection line between two network nodes. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8", className)} aria-hidden>
      <defs>
        <linearGradient id="joblio-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--brand)" />
          <stop offset="1" stopColor="var(--aurora)" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9.5" fill="url(#joblio-mark)" />
      <path d="M19.4 9.2v8.9a5.3 5.3 0 0 1-10.6 0" stroke="white" strokeWidth="3.1" strokeLinecap="round" fill="none" />
      <circle cx="19.4" cy="9.2" r="2.7" fill="white" />
      <circle cx="24.6" cy="22.6" r="2" fill="var(--mint)" />
    </svg>
  );
}

export function Logo({ href = "/", className, compact }: { href?: string; className?: string; compact?: boolean }) {
  return (
    <Link href={href} className={cn("group inline-flex items-center gap-2.5", className)} aria-label="JOBLIO">
      <LogoMark className="transition-transform duration-500 ease-[var(--ease-spring)] group-hover:-rotate-6 group-hover:scale-105" />
      {!compact && <span className="font-display text-[19px] font-semibold tracking-[-0.04em]">joblio</span>}
    </Link>
  );
}
