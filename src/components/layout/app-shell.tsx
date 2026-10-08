"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { m } from "motion/react";
import { useState, type ReactNode } from "react";
import {
  Bell,
  Briefcase,
  Building2,
  CreditCard,
  Crown,
  Home,
  KanbanSquare,
  Languages,
  LogOut,
  MessageSquare,
  Search,
  Settings,
  ShieldCheck,
  Trophy,
  User,
  Users,
} from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Avatar } from "@/components/ui/avatar";
import { buttonClasses } from "@/components/ui/button";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { LanguageToggle } from "@/components/layout/language-switcher";
import { useI18n } from "@/i18n/client";
import type { TKey } from "@/i18n/translate";
import { RealtimeProvider, useRealtime, type Counts } from "@/components/realtime/realtime-provider";
import { authClient } from "@/lib/auth-client";
import { setLocaleAction } from "@/server/actions/locale";
import { cn } from "@/lib/utils";

export type ShellViewer = {
  id: string;
  name: string;
  image: string | null;
  username: string;
  headline: string | null;
  company: { slug: string; name: string } | null;
  boosted: boolean;
};

type NavItem = { href: string; label: TKey; icon: typeof Home; badge?: keyof Counts; match?: string[] };

const NAV: NavItem[] = [
  { href: "/home", label: "nav.home", icon: Home, match: ["/home", "/feed"] },
  { href: "/jobs", label: "nav.jobs", icon: Briefcase, match: ["/jobs", "/applications", "/interviews"] },
  { href: "/network", label: "nav.network", icon: Users, badge: "pendingConnections", match: ["/network", "/companies", "/professionals"] },
  { href: "/messages", label: "nav.messages", icon: MessageSquare, badge: "messages" },
  { href: "/notifications", label: "nav.alerts", icon: Bell, badge: "notifications" },
];

function isActive(pathname: string, item: NavItem) {
  return (item.match ?? [item.href]).some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function CountBadge({ n, className }: { n: number; className?: string }) {
  if (!n) return null;
  return (
    <m.span
      key={n}
      initial={{ scale: 0.4 }}
      animate={{ scale: 1 }}
      transition={{ type: "spring", stiffness: 600, damping: 18 }}
      className={cn("absolute grid h-[18px] min-w-[18px] place-items-center rounded-full bg-danger px-1 text-[10px] font-bold text-white ring-2 ring-[var(--bg)]", className)}
    >
      {n > 99 ? "99+" : n}
    </m.span>
  );
}

function UserMenu({ viewer }: { viewer: ShellViewer }) {
  const router = useRouter();
  const { t, locale } = useI18n();
  async function signOut() {
    await authClient.signOut();
    router.push("/");
    router.refresh();
  }
  return (
    <Menu>
      <MenuTrigger className="rounded-full outline-none ring-offset-2 ring-offset-[var(--bg)] transition focus-visible:ring-2 focus-visible:ring-[var(--ring)]" aria-label={t("nav.accountMenu")}>
        <Avatar name={viewer.name} src={viewer.image} size="sm" />
      </MenuTrigger>
      <MenuContent className="w-64">
        <Link href={`/in/${viewer.username}`} className="flex items-center gap-3 rounded-xl p-2.5 hover:bg-surface-2">
          <Avatar name={viewer.name} src={viewer.image} size="md" />
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{viewer.name}</div>
            <div className="truncate text-xs text-fg-muted">{viewer.headline ?? t("nav.viewProfile")}</div>
          </div>
        </Link>
        <MenuSeparator />
        <MenuItem icon={<User />} onSelect={() => router.push(`/in/${viewer.username}`)}>
          {t("nav.myProfile")}
        </MenuItem>
        <MenuItem icon={<Trophy />} onSelect={() => router.push("/profile/achievements")}>
          {t("nav.achievements")}
        </MenuItem>
        <MenuItem icon={<Briefcase />} onSelect={() => router.push("/applications")}>
          {t("nav.myApplications")}
        </MenuItem>
        {viewer.company ? (
          <>
            <MenuSeparator />
            <MenuLabel>{viewer.company.name}</MenuLabel>
            <MenuItem icon={<KanbanSquare />} onSelect={() => router.push("/recruiter")}>
              {t("nav.recruiterDashboard")}
            </MenuItem>
            <MenuItem icon={<Building2 />} onSelect={() => router.push("/company/dashboard")}>
              {t("nav.companyDashboard")}
            </MenuItem>
          </>
        ) : (
          <MenuItem icon={<Building2 />} onSelect={() => router.push("/recruiter/setup")}>
            {t("nav.hireOnJoblio")}
          </MenuItem>
        )}
        <MenuSeparator />
        <MenuItem icon={<Crown />} onSelect={() => router.push("/premium")}>
          {t("nav.premium")}
        </MenuItem>
        <MenuItem icon={<CreditCard />} onSelect={() => router.push("/settings/billing")}>
          {t("nav.billing")}
        </MenuItem>
        <MenuItem icon={<ShieldCheck />} onSelect={() => router.push("/settings/privacy")}>
          {t("nav.privacy")}
        </MenuItem>
        <MenuItem icon={<Languages />} onSelect={async () => { await setLocaleAction(locale === "en" ? "ar" : "en"); router.refresh(); }}>
          <span lang={locale === "en" ? "ar" : "en"}>{locale === "en" ? "العربية" : "English"}</span>
        </MenuItem>
        <MenuItem icon={<Settings />} onSelect={() => router.push("/settings")}>
          {t("nav.settings")}
        </MenuItem>
        <MenuSeparator />
        <MenuItem icon={<LogOut />} onSelect={signOut} danger>
          {t("common.signOut")}
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}

function GlobalSearch({ className }: { className?: string }) {
  const router = useRouter();
  const { t } = useI18n();
  const [q, setQ] = useState("");
  return (
    <form
      role="search"
      className={cn("relative", className)}
      onSubmit={(e) => {
        e.preventDefault();
        router.push(`/jobs${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`);
      }}
    >
      <Search className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t("nav.searchPlaceholder")}
        aria-label={t("common.search")}
        className="h-10 w-full rounded-full border border-transparent bg-surface-2 ps-10 pe-4 text-sm outline-none transition focus:border-brand focus:bg-surface focus:ring-4 focus:ring-[var(--ring)]/20"
      />
    </form>
  );
}

function DesktopNav({ viewer }: { viewer: ShellViewer }) {
  const pathname = usePathname();
  const { counts } = useRealtime();
  const { t } = useI18n();
  return (
    <nav className="hidden items-center gap-0.5 md:flex">
      {NAV.map((item) => {
        const active = isActive(pathname, item);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn("relative flex w-[72px] flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px] font-medium transition-colors", active ? "text-fg" : "text-fg-muted hover:text-fg")}
          >
            <span className="relative">
              <item.icon className="size-5" strokeWidth={active ? 2.3 : 1.9} />
              {item.badge && <CountBadge n={counts[item.badge]} className="-end-2.5 -top-1.5" />}
            </span>
            {t(item.label)}
            {active && <m.span layoutId="desktop-nav" className="absolute -bottom-[13px] h-[2.5px] w-8 rounded-full bg-brand" />}
          </Link>
        );
      })}
      {viewer.company && (
        <Link
          href="/recruiter"
          className={cn(
            "relative flex w-[72px] flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px] font-medium transition-colors",
            pathname.startsWith("/recruiter") || pathname.startsWith("/company") ? "text-fg" : "text-fg-muted hover:text-fg",
          )}
        >
          <KanbanSquare className="size-5" />
          {t("nav.hiring")}
          {(pathname.startsWith("/recruiter") || pathname.startsWith("/company")) && <m.span layoutId="desktop-nav" className="absolute -bottom-[13px] h-[2.5px] w-8 rounded-full bg-brand" />}
        </Link>
      )}
    </nav>
  );
}

function MobileNav({ viewer }: { viewer: ShellViewer }) {
  const pathname = usePathname();
  const { counts } = useRealtime();
  const { t } = useI18n();
  const items: (NavItem & { avatar?: boolean })[] = [
    NAV[0]!,
    NAV[1]!,
    NAV[2]!,
    NAV[3]!,
    { href: `/in/${viewer.username}`, label: "nav.profile", icon: User, match: [`/in/${viewer.username}`, "/profile", "/settings"], avatar: true },
  ];
  return (
    <nav className="glass fixed inset-x-0 bottom-0 z-40 border-t border-border pb-[env(safe-area-inset-bottom)] md:hidden" aria-label={t("nav.menu")}>
      <div className="grid grid-cols-5">
        {items.map((item) => {
          const active = isActive(pathname, item);
          return (
            <Link key={item.label} href={item.href} className={cn("relative flex flex-col items-center gap-1 py-2.5 text-[10.5px] font-medium", active ? "text-brand-soft-fg" : "text-fg-muted")}>
              {active && <m.span layoutId="mobile-nav" className="absolute inset-x-3 top-0 h-[2.5px] rounded-full bg-brand" />}
              <span className="relative">
                {item.avatar ? <Avatar name={viewer.name} src={viewer.image} size="xs" className={cn(active && "ring-2 ring-brand rounded-full")} /> : <item.icon className="size-[22px]" strokeWidth={active ? 2.3 : 1.9} />}
                {item.badge && <CountBadge n={counts[item.badge]} className="-end-2.5 -top-1" />}
              </span>
              {t(item.label)}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function MobileTopBar() {
  const { counts } = useRealtime();
  const { t } = useI18n();
  return (
    <div className="flex items-center gap-1 md:hidden">
      <Link href="/jobs" className="grid size-9 place-items-center rounded-full text-fg-muted hover:bg-surface-2" aria-label={t("common.search")}>
        <Search className="size-5" />
      </Link>
      <Link href="/notifications" className="relative grid size-9 place-items-center rounded-full text-fg-muted hover:bg-surface-2" aria-label={t("nav.notifications")}>
        <Bell className="size-5" />
        <CountBadge n={counts.notifications} className="end-0.5 top-0.5" />
      </Link>
    </div>
  );
}

export function AppShell({ viewer, counts, children }: { viewer: ShellViewer | null; counts: Counts | null; children: ReactNode }) {
  const { t } = useI18n();
  const header = (
    <header className="glass sticky top-0 z-40 border-b border-border">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <Logo href={viewer ? "/home" : "/"} compact={!!viewer} className="shrink-0" />
        {viewer ? (
          <>
            <GlobalSearch className="hidden w-full max-w-xs lg:block" />
            <div className="ms-auto flex items-center gap-1">
              <DesktopNav viewer={viewer} />
              <MobileTopBar />
              <span className="mx-1 hidden h-8 w-px bg-border md:block" />
              <LanguageToggle className="hidden sm:inline-flex" />
              <ThemeToggle className="hidden sm:grid" />
              <UserMenu viewer={viewer} />
            </div>
          </>
        ) : (
          <div className="ms-auto flex items-center gap-1.5">
            <Link href="/jobs" className="hidden rounded-full px-3 py-2 text-sm text-fg-muted hover:text-fg sm:block">
              {t("nav.jobs")}
            </Link>
            <Link href="/companies" className="hidden rounded-full px-3 py-2 text-sm text-fg-muted hover:text-fg sm:block">
              {t("nav.companies")}
            </Link>
            <LanguageToggle />
            <ThemeToggle />
            <Link href="/login" className={buttonClasses({ variant: "ghost", size: "sm" })}>
              {t("common.signIn")}
            </Link>
            <Link href="/register" className={buttonClasses({ size: "sm", pill: true })}>
              {t("common.joinFree")}
            </Link>
          </div>
        )}
      </div>
    </header>
  );

  if (!viewer || !counts) {
    return (
      <div className="min-h-dvh">
        {header}
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      </div>
    );
  }

  return (
    <RealtimeProvider initialCounts={counts}>
      <div className="min-h-dvh pb-20 md:pb-0">
        {header}
        <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-8">{children}</main>
        <MobileNav viewer={viewer} />
      </div>
    </RealtimeProvider>
  );
}
