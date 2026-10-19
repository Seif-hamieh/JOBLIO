"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Briefcase, Building2, CreditCard, FileText, LayoutDashboard, Receipt, Settings, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";

// `ready: false` items are listed as "coming soon" until their page exists.
const ITEMS = [
  { href: "/admin", key: "admin.dashboard", icon: LayoutDashboard, ready: true, exact: true },
  { href: "/admin/users", key: "admin.users", icon: Users, ready: true },
  { href: "/admin/companies", key: "admin.companies", icon: Building2, ready: true },
  { href: "/admin/jobs", key: "admin.jobs", icon: Briefcase, ready: true },
  { href: "/admin/subscriptions", key: "admin.subscriptions", icon: CreditCard, ready: true },
  { href: "/admin/payments", key: "admin.payments", icon: Receipt, ready: true },
  { href: "/admin/applications", key: "admin.applications", icon: FileText, ready: true },
  { href: "/admin/settings", key: "admin.settings", icon: Settings, ready: true },
] as const;

export function AdminNav() {
  const { t } = useI18n();
  const pathname = usePathname();
  const item = "flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2 text-sm [&_svg]:size-4 [&_svg]:shrink-0";

  return (
    // Phones: a horizontal strip that stays pinned under the site header (top bar = 4rem + safe area),
    // so the admin links never scroll away. From md (768px): the sidebar on the start side.
    <nav
      aria-label={t("admin.title")}
      className="glass sticky top-[calc(4rem+env(safe-area-inset-top))] z-30 -mx-4 min-w-0 border-b border-border/60 px-4 py-2 sm:-mx-6 sm:px-6 md:top-24 md:z-auto md:mx-0 md:self-start md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none"
    >
      <ul className="scrollbar-none flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
        {ITEMS.map(({ href, key, icon: Icon, ready, ...rest }) => {
          const active = "exact" in rest ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href}>
              {ready ? (
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(item, active ? "bg-brand-soft font-medium text-brand-soft-fg" : "text-fg-muted hover:bg-surface-2 hover:text-fg")}
                >
                  <Icon />
                  {t(key)}
                </Link>
              ) : (
                <span aria-disabled className={cn(item, "cursor-not-allowed text-fg-subtle")}>
                  <Icon />
                  {t(key)}
                  <Badge tone="neutral" size="xs" className="ms-auto">
                    {t("admin.comingSoon")}
                  </Badge>
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
