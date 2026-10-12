import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import localFont from "next/font/local";
import { Providers } from "@/components/providers";
import { I18nProvider } from "@/i18n/client";
import { displayNames, getI18n } from "@/i18n/server";
import { APP_URL } from "@/lib/utils";
import { THEME_SCRIPT } from "@/lib/theme-script";
import "./globals.css";

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
    openGraph: {
      type: "website",
      siteName: "JOBLIO",
      url: path,
      title: t("meta.title"),
      description: t("meta.description"),
      locale: locale === "ar" ? "ar_AR" : "en_US",
      alternateLocale: locale === "ar" ? ["en_US"] : ["ar_AR"],
    },
    twitter: { card: "summary_large_image", title: t("meta.title"), description: t("meta.description") },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f7fc" },
    { media: "(prefers-color-scheme: dark)", color: "#14131f" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { locale, dir } = await getI18n();
  return (
    <html lang={locale} dir={dir} suppressHydrationWarning className={`${inter.variable} ${sora.variable} ${notoArabic.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-dvh">
        <I18nProvider locale={locale} names={displayNames(locale)}>
          <Providers>{children}</Providers>
        </I18nProvider>
      </body>
    </html>
  );
}
