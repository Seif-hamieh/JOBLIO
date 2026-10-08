import { NavTabs } from "@/components/ui/controls";
import { requireViewer } from "@/server/session";
import { getI18n } from "@/i18n/server";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const [, { t }] = await Promise.all([requireViewer(), getI18n()]);
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <NavTabs
        layoutId="settings-tabs"
        tabs={[
          { href: "/settings", label: t("nav.settings"), exact: true },
          { href: "/settings/privacy", label: t("nav.privacy") },
          { href: "/settings/billing", label: t("nav.billing") },
        ]}
      />
      {children}
    </div>
  );
}
