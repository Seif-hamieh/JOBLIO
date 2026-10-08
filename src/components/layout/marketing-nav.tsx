"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatePresence, m } from "motion/react";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { buttonClasses } from "@/components/ui/button";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { LanguageToggle } from "@/components/layout/language-switcher";
import { useI18n } from "@/i18n/client";
import type { TKey } from "@/i18n/translate";
import { cn } from "@/lib/utils";

const LINKS: { href: string; label: TKey }[] = [
  { href: "/jobs", label: "nav.jobs" },
  { href: "/companies", label: "nav.companies" },
  { href: "/professionals/featured", label: "nav.professionals" },
  { href: "/#employers", label: "nav.forEmployers" },
  { href: "/premium", label: "nav.pricing" },
];

export function MarketingNav() {
  const { t } = useI18n();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={cn("sticky top-0 z-40 transition-all duration-300", scrolled ? "glass border-b border-border" : "border-b border-transparent")}>
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6">
        <Logo />
        <nav className="hidden items-center gap-1 lg:flex">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="rounded-full px-3.5 py-2 text-sm text-fg-muted transition hover:bg-surface-2 hover:text-fg">
              {t(l.label)}
            </Link>
          ))}
        </nav>
        <div className="ms-auto flex items-center gap-1.5">
          <LanguageToggle />
          <ThemeToggle />
          <Link href="/login" className={buttonClasses({ variant: "ghost", size: "sm", className: "hidden sm:inline-flex" })}>
            {t("common.signIn")}
          </Link>
          <Link href="/register" className={buttonClasses({ variant: "primary", size: "sm", pill: true })}>
            {t("common.joinFree")}
          </Link>
          <button className="grid size-9 place-items-center rounded-full hover:bg-surface-2 lg:hidden" onClick={() => setOpen((o) => !o)} aria-label={t("nav.menu")} aria-expanded={open}>
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>
      <AnimatePresence>
        {open && (
          <m.nav
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-border bg-surface lg:hidden"
          >
            <div className="flex flex-col p-3">
              {[...LINKS, { href: "/login", label: "common.signIn" as TKey }].map((l) => (
                <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="rounded-xl px-3 py-3 text-[15px] font-medium hover:bg-surface-2">
                  {t(l.label)}
                </Link>
              ))}
            </div>
          </m.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
