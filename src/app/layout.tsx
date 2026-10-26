import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import localFont from "next/font/local";
import { Providers } from "@/components/providers";
import { MobileAppBanner } from "@/components/pwa/mobile-app-banner";
import { I18nProvider } from "@/i18n/client";
import { displayNames, getI18n } from "@/i18n/server";
import { APP_URL } from "@/lib/utils";
import { THEME_SCRIPT } from "@/lib/theme-script";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";

const inter = localFont({
  src: "../fonts/inter-latin.woff2",
  variable: "--font-inter",
  weight: "100 900",
  display: "swap",
});

const sora = localFont({
  src: "../fonts/sora-latin.woff2",
  variable: "--font-sora",
  weight: "100 800",
  display: "swap",
  // Headings only: not preloaded, which removed the "preloaded but not used" warning on pages
  // that show it late; it still loads as soon as a heading needs it (swap shows text meanwhile).
  preload: false,
});

const notoArabic = localFont({
  src: "../fonts/noto-arabic.woff2",
  variable: "--font-noto-arabic",
  weight: "100 900",
  display: "swap",
  // Only fetched when Arabic glyphs are actually on the page.
  preload: false,
});

export async function generateMetadata(): Promise<Metadata> {
  const { t, locale } = await getI18n();
  // Each page's canonical URL is its own path (set by src/proxy.ts), without query parameters.
  const path = (await headers()).get("x-pathname") ?? "/";
  return {
    metadataBase: new URL(APP_URL),
    title: { default: t("meta.title"), template: "%s · JOBLIO" },
    description: t("meta.description"),
    applicationName: "JOBLIO",
    alternates: { canonical: path },
    // No fixed og:title / og:description here: pages set their own, and link previews otherwise use the
    // page's <title> and description — so shared links no longer all say the same thing.
    openGraph: {
      type: "website",
      siteName: "JOBLIO",
      url: path,
      locale: locale === "ar" ? "ar_AR" : "en_US",
      alternateLocale: locale === "ar" ? ["en_US"] : ["ar_AR"],
    },
    twitter: { card: "summary_large_image" },
    // Installed on iOS (Add to Home Screen): full-screen with the status bar drawn over the page;
    // the sticky headers pad themselves with env(safe-area-inset-top).
    appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "JOBLIO" },
    // Next emits the standard mobile-web-app-capable; older iOS versions only read Apple’s name.
    other: { "apple-mobile-web-app-capable": "yes" },
  };
}

export const viewport: Viewport = {
  // Lets the installed app use the whole screen (notch / home indicator handled with safe-area insets).
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f7fc" },
    { media: "(prefers-color-scheme: dark)", color: "#14131f" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [{ locale, dir, t }, nonce] = await Promise.all([getI18n(), headers().then((h) => h.get("x-nonce") ?? undefined)]);
  return (
    <html lang={locale} dir={dir} suppressHydrationWarning className={`${inter.variable} ${sora.variable} ${notoArabic.variable}`}>
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-dvh">
        <a
          href="#main"
          className="sr-only z-[100] rounded-full bg-brand px-4 py-2 text-sm font-semibold text-brand-fg focus:not-sr-only focus:fixed focus:start-4 focus:top-4"
        >
          {t("common.skipToContent")}
        </a>
        <I18nProvider locale={locale} names={displayNames(locale)}>
          <Providers>{children}</Providers>
          {/* "Get the JOBLIO App" on Android phones, on every page (closing it is remembered). */}
          <MobileAppBanner />
        </I18nProvider>
        <Analytics />
      </body>
    </html>
  );
}
