import Link from "next/link";
import { getI18n, pageTitle } from "@/i18n/server";
import { JobAlertList } from "@/components/jobs/job-alert-list";
import { listJobAlerts } from "@/server/services/job-alerts";
import { requireViewer } from "@/server/session";
import { db } from "@/server/db";
import { myPremiumFeatures } from "@/server/services/premium";
import { buttonClasses } from "@/components/ui/button";
import { Card, PageHeader } from "@/components/ui/misc";
import { ThemeSelect } from "@/components/layout/theme-toggle";
import { LanguageSelect } from "@/components/layout/language-switcher";
import { InstallApp } from "@/components/pwa/install-app";
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
  const [user, settings, credential, profile, portfolioSub, jobAlerts, premium] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: viewer.id }, select: { email: true, createdAt: true } }),
    db.userSettings.findUnique({ where: { userId: viewer.id } }),
    db.account.findFirst({ where: { userId: viewer.id, providerId: "credential" }, select: { id: true } }),
    db.profile.findUnique({ where: { id: viewer.profileId }, select: { portfolioEnabled: true, portfolioAccent: true } }),
    db.subscription.findFirst({
      where: { userId: viewer.id, product: "PREMIUM_PORTFOLIO", status: { in: ["ACTIVE", "TRIALING"] }, currentPeriodEnd: { gt: new Date() } },
      select: { id: true },
    }),
    listJobAlerts(viewer.id),
    myPremiumFeatures(viewer.id),
  ]);
  const day = (d: Date) => f.date(d, { day: "numeric", month: "short", year: "numeric" });

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

      <Section id="premium" title={t("myPremium.title")} description={t("myPremium.sub")}>
        {premium.features.length || premium.priorityCredits ? (
          <ul className="space-y-2.5">
            {premium.features.map((p) => (
              <li key={p.product} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-border p-3.5">
                <span aria-hidden>👑</span>
                <span className="font-medium">{t(`premium.products.${p.product}.name`)}</span>
                <span className="text-sm text-fg-muted">{t(p.renews ? "myPremium.renews" : "myPremium.until", { date: day(p.until) })}</span>
                {p.gift && <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-medium text-brand-soft-fg">{t("myPremium.gift")}</span>}
              </li>
            ))}
            {premium.priorityCredits > 0 && (
              <li className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-border p-3.5">
                <span aria-hidden>👑</span>
                <span className="font-medium">{t("premium.products.PRIORITY_APPLICATION.name")}</span>
                <span className="text-sm text-fg-muted">{t("myPremium.credits", { n: premium.priorityCredits })}</span>
              </li>
            )}
          </ul>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-fg-muted">{t("myPremium.none")}</p>
            <Link href="/premium" className={buttonClasses({ size: "sm", variant: "soft", pill: true })}>
              {t("myPremium.see")}
            </Link>
          </div>
        )}
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

      <Section id="install" title={t("pwa.install_app")} description={t("pwa.install_app_description")}>
        <InstallApp />
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

      <Section id="job-alerts" title={t("settings.jobAlerts")} description={t("settings.jobAlertsSub")}>
        {jobAlerts.length ? (
          <JobAlertList alerts={jobAlerts} />
        ) : (
          <p className="text-sm text-fg-muted">
            {t("settings.noJobAlerts")}{" "}
            <Link href="/jobs" className="font-medium text-brand-soft-fg hover:underline">
              {t("settings.findJobs")}
            </Link>
          </p>
        )}
      </Section>

      <Section id="password" title={t("settings.password")}>
        {credential ? <ChangePasswordForm /> : <p className="text-sm text-fg-muted">{t("settings.socialOnly")}</p>}
      </Section>

      <Section id="portfolio" title={t("settings.portfolio")} description={t("settings.portfolioSub", { url: `getjoblio.app/${viewer.username}` })}>
        <PortfolioForm username={viewer.username} enabled={!!profile?.portfolioEnabled} accent={profile?.portfolioAccent ?? null} entitled={!!portfolioSub} />
      </Section>

      <Section id="danger" title={t("settings.danger")} description={t("settings.dangerSub")}>
        <DeleteAccount />
      </Section>
    </div>
  );
}
