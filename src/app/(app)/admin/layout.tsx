import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getI18n } from "@/i18n/server";
import { requireAdmin } from "@/server/session";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/misc";
import { AdminNav } from "@/components/admin/admin-nav";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Every admin page sits under this layout: non-admins get a 404 before anything renders.
  const [, { t }] = await Promise.all([requireAdmin(), getI18n()]);

  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl space-y-6">
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            {t("admin.title")}
            <Badge tone="brand">{t("admin.badge")}</Badge>
          </span>
        }
        actions={
          <Link href="/home" className={buttonClasses({ variant: "outline", size: "sm" })}>
            <ArrowLeft className="rtl:rotate-180" /> {t("admin.backToSite")}
          </Link>
        }
      />

      {/* grid-cols-1 (= minmax(0, 1fr)) keeps wide tables from stretching the page on phones; they scroll inside their card. */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <AdminNav />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
