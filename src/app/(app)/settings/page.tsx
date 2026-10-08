import { getI18n, pageTitle } from "@/i18n/server";
import { requireViewer } from "@/server/session";
import { db } from "@/server/db";
import { Card, PageHeader } from "@/components/ui/misc";
import { ThemeSelect } from "@/components/layout/theme-toggle";
import { LanguageSelect } from "@/components/layout/language-switcher";
import { ChangePasswordForm, DeleteAccount, NotificationSettingsForm, PortfolioForm } from "@/components/settings/settings-forms";

export const generateMetadata = pageTitle("nav.settings");

function Section({ id, title, description, children }: { id: string; title: string; description?: string; children: React.ReactNode }) {
  return (
    <Card as="section" className="scroll-mt-24 p-6 sm:p-7">
      <div id={id} className="scroll-mt-28">
        <h2 className="font-display text-lg font-semibold">{title}</h2>
        {description && <p className="mt-1 text-sm text-fg-muted">{description}</p>}
      </div>
      <div className="mt-5">{children}</div>
    </Card>
  );
}

export default async function SettingsPage() {
  const [viewer, { t, f }] = await Promise.all([requireViewer(), getI18n()]);
  const [user, settings, credential, profile, portfolioSub] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: viewer.id }, select: { email: true, createdAt: true } }),
    db.userSettings.findUnique({ where: { userId: viewer.id } }),
    db.account.findFirst({ where: { userId: viewer.id, providerId: "credential" }, select: { id: true } }),
    db.profile.findUnique({ where: { id: viewer.profileId }, select: { portfolioEnabled: true, portfolioAccent: true } }),
    db.subscription.findFirst({
      where: { userId: viewer.id, product: "PREMIUM_PORTFOLIO", status: { in: ["ACTIVE", "TRIALING"] }, currentPeriodEnd: { gt: new Date() } },
      select: { id: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title={t("settings.title")} description={t("settings.sub")} />

      <Section id="account" title={t("settings.account")}>
        <dl className="grid gap-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-fg-subtle">{t("settings.email")}</dt>
            <dd className="mt-0.5 font-medium">
              <bdi>{user.email}</bdi>
            </dd>
          </div>
          <div>
            <dt className="text-fg-subtle">{t("settings.username")}</dt>
            <dd className="mt-0.5 font-medium">
              <bdi>@{viewer.username}</bdi>
            </dd>
          </div>
          <div>
            <dt className="text-fg-subtle">JOBLIO</dt>
            <dd className="mt-0.5 font-medium">{t("settings.memberSince", { date: f.date(user.createdAt, { month: "long", year: "numeric" }) })}</dd>
          </div>
        </dl>
      </Section>

      <Section id="appearance" title={t("settings.appearance")} description={t("settings.languageHint")}>
        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <div className="mb-2 text-[13px] font-medium">{t("common.language")}</div>
            <LanguageSelect />
          </div>
          <div>
            <div className="mb-2 text-[13px] font-medium">{t("common.theme")}</div>
            <ThemeSelect />
          </div>
        </div>
      </Section>

      <Section id="notifications" title={t("settings.notifications")} description={t("settings.notificationsSub")}>
        <NotificationSettingsForm
          initial={{
            emailNotifications: settings?.emailNotifications ?? true,
            notifyMessages: settings?.notifyMessages ?? true,
            notifyApplications: settings?.notifyApplications ?? true,
            notifyNetwork: settings?.notifyNetwork ?? true,
            notifyJobAlerts: settings?.notifyJobAlerts ?? true,
            notifyPosts: settings?.notifyPosts ?? true,
            notifyProfileViews: settings?.notifyProfileViews ?? true,
          }}
        />
      </Section>

      <Section id="password" title={t("settings.password")}>
        {credential ? <ChangePasswordForm /> : <p className="text-sm text-fg-muted">{t("settings.socialOnly")}</p>}
      </Section>

      <Section id="portfolio" title={t("settings.portfolio")} description={t("settings.portfolioSub", { url: `joblio.com/${viewer.username}` })}>
        <PortfolioForm username={viewer.username} enabled={!!profile?.portfolioEnabled} accent={profile?.portfolioAccent ?? null} entitled={!!portfolioSub} />
      </Section>

      <Section id="danger" title={t("settings.danger")} description={t("settings.dangerSub")}>
        <DeleteAccount />
      </Section>
    </div>
  );
}
