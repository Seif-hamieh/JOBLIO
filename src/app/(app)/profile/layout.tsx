import { NavTabs } from "@/components/ui/controls";
import { getI18n } from "@/i18n/server";

export default async function ProfileAreaLayout({ children }: { children: React.ReactNode }) {
  const { t } = await getI18n();
  return (
    <div className="space-y-6">
      <NavTabs
        layoutId="profile-tabs"
        tabs={[
          { href: "/profile/edit", label: t("profile.tabEdit") },
          { href: "/profile/skills", label: t("profile.tabSkills") },
          { href: "/profile/projects", label: t("profile.tabProjects") },
          { href: "/profile/journey", label: t("profile.tabJourney") },
          { href: "/profile/achievements", label: t("profile.tabAchievements") },
          { href: "/profile/views", label: t("profile.tabViews") },
        ]}
      />
      {children}
    </div>
  );
}