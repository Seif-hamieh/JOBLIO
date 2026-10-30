import type { Metadata } from "next";
import Link from "next/link";
import QRCode from "qrcode";
import { Bell, Download, FileText, FolderOpen, Globe, MessageCircle, RefreshCw, Settings2, ShieldCheck, Smartphone, Sparkles, Target, Apple, PackageCheck } from "lucide-react";
import { getI18n } from "@/i18n/server";
import { APK_PATH, apkSizeMb, latestAppVersion } from "@/server/app-version";
import { InstallPWA } from "@/components/pwa/install-pwa";
import { APP_URL } from "@/lib/utils";

// /app — the Android app's download page: the APK button with its version and size, a QR code for people on a
// computer, install steps (allowing the source, Play Protect), and the web app for iPhone. The version is
// MOBILE_APP_LATEST_VERSION and the size is read from public/app, so the page follows each new APK by itself.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return {
    title: t("appPage.metaTitle"),
    description: t("appPage.metaDescription"),
    alternates: { canonical: "/app" },
    openGraph: { title: t("appPage.metaTitle"), description: t("appPage.metaDescription"), url: "/app" },
  };
}

export default async function AppDownloadPage() {
  const apkUrl = `${APP_URL}${APK_PATH}`;
  const [{ t }, size, qr] = await Promise.all([
    getI18n(),
    apkSizeMb(),
    // Dark on white: phone cameras read QR codes best that way, whatever the page's theme.
    QRCode.toString(apkUrl, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#0A0A0C", light: "#FFFFFF" } }),
  ]);
  const version = latestAppVersion();

  const features = [
    { icon: Target, text: t("appPage.f1") },
    { icon: FileText, text: t("appPage.f2") },
    { icon: MessageCircle, text: t("appPage.f3") },
    { icon: Sparkles, text: t("appPage.f4") },
    { icon: Bell, text: t("appPage.f5") },
    { icon: RefreshCw, text: t("appPage.f6") },
  ];
  const steps = [
    { icon: Download, title: t("appPage.s1Title"), body: t("appPage.s1Body") },
    { icon: FolderOpen, title: t("appPage.s2Title"), body: t("appPage.s2Body") },
    { icon: Settings2, title: t("appPage.s3Title"), body: t("appPage.s3Body") },
    { icon: PackageCheck, title: t("appPage.s4Title"), body: t("appPage.s4Body") },
  ];

  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute -top-56 left-1/2 h-[560px] w-[1000px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklch,var(--brand)_14%,transparent),transparent)]" />

      {/* Hero: the download, and the QR code beside it on big screens. */}
      <section className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-14 sm:px-6 sm:pt-20 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/70 px-3 py-1 text-xs font-medium text-fg-muted backdrop-blur">
            <Smartphone className="size-3.5 text-brand" /> {t("appPage.badge")}
          </span>
          <h1 className="mt-5 font-display text-[44px] font-semibold leading-[1.04] tracking-[-0.04em] sm:text-6xl">
            <span className="text-gradient">{t("appPage.title")}</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-fg-muted">{t("appPage.subtitle")}</p>

          <div className="mt-8 flex flex-col items-start gap-3">
            <a
              href={APK_PATH}
              download="getjoblio.apk"
              className="group inline-flex items-center gap-3 rounded-2xl bg-brand px-7 py-4 text-lg font-semibold text-white shadow-[0_12px_40px_-12px_var(--brand)] transition hover:brightness-110 active:scale-[0.98]"
            >
              <Download className="size-6 transition group-hover:translate-y-0.5" />
              {t("appPage.download")}
            </a>
            <span className="text-sm text-fg-subtle">{size ? t("appPage.versionLine", { version, size }) : t("appPage.versionOnly", { version })}</span>
          </div>
        </div>

        {/* For computers: on a phone the button above is the way. */}
        <div className="surface mx-auto hidden w-full max-w-sm p-6 text-center md:block">
          <div className="mx-auto w-56 overflow-hidden rounded-2xl bg-white p-3 shadow-lg" role="img" aria-label={apkUrl} dangerouslySetInnerHTML={{ __html: qr }} />
          <h2 className="mt-5 font-display text-lg font-semibold">{t("appPage.scanTitle")}</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">{t("appPage.scanBody")}</p>
        </div>
      </section>

      {/* What the app does. */}
      <section className="relative mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        <h2 className="font-display text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">{t("appPage.featuresTitle")}</h2>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <li key={f.text} className="surface flex items-center gap-3 p-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-border bg-surface-2 text-brand">
                <f.icon className="size-5" />
              </span>
              <span className="font-medium">{f.text}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Install steps. */}
      <section className="relative mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        <h2 className="font-display text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">{t("appPage.stepsTitle")}</h2>
        <p className="mt-2 max-w-2xl text-fg-muted">{t("appPage.stepsIntro")}</p>
        <ol className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <li key={s.title} className="surface relative p-5">
              <span className="absolute end-4 top-4 font-display text-4xl font-semibold text-fg-subtle/30">{i + 1}</span>
              <span className="grid size-11 place-items-center rounded-xl bg-brand-soft text-brand-soft-fg">
                <s.icon className="size-5" />
              </span>
              <h3 className="mt-4 font-semibold">{s.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">{s.body}</p>
            </li>
          ))}
        </ol>

        <div className="mt-6 flex gap-4 rounded-2xl border border-border bg-surface-2/60 p-5">
          <ShieldCheck className="mt-0.5 size-6 shrink-0 text-mint" />
          <div>
            <h3 className="font-semibold">{t("appPage.protectTitle")}</h3>
            <p className="mt-1 text-sm leading-relaxed text-fg-muted">{t("appPage.protectBody")}</p>
          </div>
        </div>
      </section>

      {/* iPhone: the web app. */}
      <section className="relative mx-auto max-w-6xl px-4 pb-24 sm:px-6">
        <div className="surface flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:p-8">
          <span className="grid size-14 shrink-0 place-items-center rounded-2xl border border-border bg-surface-2">
            <Apple className="size-7" />
          </span>
          <div className="flex-1">
            <h2 className="font-display text-xl font-semibold">{t("appPage.iphoneTitle")}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">{t("appPage.iphoneBody")}</p>
            <p className="mt-1 text-sm text-fg-subtle">{t("appPage.iphoneSteps")}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <InstallPWA />
            <Link href="/" className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-semibold transition hover:border-brand/50">
              <Globe className="size-4" /> {t("appPage.openWeb")}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
