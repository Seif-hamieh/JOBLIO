import Link from "next/link";
import { Check } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { MatchRing } from "@/components/match/match-ring";
import { Avatar } from "@/components/ui/avatar";
import { LanguageToggle } from "@/components/layout/language-switcher";
import { getI18n } from "@/i18n/server";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const { t, f } = await getI18n();
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_1.05fr]">
      <div className="flex flex-col px-5 py-6 sm:px-10">
        <div className="flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-1">
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </div>
        <main className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-10">{children}</main>
        <p className="text-center text-xs text-fg-subtle">
          {/* Split the sentence around its two links so word order follows the language. */}
          {t("legal.agree", { terms: "\u0001", privacy: "\u0002" })
            .split(/([\u0001\u0002])/)
            .map((part, i) =>
              part === "\u0001" ? (
                <Link key={i} href="/terms" className="underline underline-offset-2 hover:text-fg">
                  {t("legal.terms")}
                </Link>
              ) : part === "\u0002" ? (
                <Link key={i} href="/privacy" className="underline underline-offset-2 hover:text-fg">
                  {t("legal.privacy")}
                </Link>
              ) : (
                part
              ),
            )}
        </p>
      </div>

      {/* Brand panel */}
      <aside className="relative hidden overflow-hidden bg-[oklch(0.2_0.06_281)] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute -end-32 -top-32 size-[520px] rounded-full bg-[radial-gradient(circle,oklch(0.6_0.2_281/0.55),transparent_65%)]" />
        <div className="pointer-events-none absolute -bottom-40 -start-24 size-[480px] rounded-full bg-[radial-gradient(circle,oklch(0.7_0.13_190/0.35),transparent_65%)]" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.12] [background-image:radial-gradient(white_1px,transparent_1px)] [background-size:22px_22px]" />
        <div className="relative">
          <h2 className="max-w-md font-display text-4xl font-semibold leading-tight tracking-tight">{t("landing.h1a")} {t("landing.h1b")} {t("landing.h1c")}</h2>
          <p className="mt-4 max-w-md text-white/70">{t("auth.panelSub")}</p>
        </div>
        <div className="relative space-y-4">
          <div className="max-w-sm rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur">
            <div className="flex items-center gap-3">
              <Avatar name="Maya Chen" size="md" />
              <div>
                <div className="font-semibold">{t("enums.experienceLevel.SENIOR")} · Frontend Engineer</div>
                <div className="text-sm text-white/60">Aurora Labs · {t("enums.workMode.REMOTE")}</div>
              </div>
              <MatchRing score={96} size={50} stroke={4} className="ms-auto" />
            </div>
            <ul className="mt-4 space-y-1.5 text-sm text-white/80">
              {[t("match.r.reqSkills", { got: 3, total: 3 }), t("match.r.expMeets", { years: f.years(6), min: 5 }), t("match.r.hlRemote")].map((line) => (
                <li key={line} className="flex items-center gap-2">
                  <Check className="size-3.5 text-[oklch(0.8_0.14_166)]" strokeWidth={3} /> {line}
                </li>
              ))}
            </ul>
          </div>
          <p className="text-sm text-white/50">{t("auth.panelFoot")}</p>
        </div>
      </aside>
    </div>
  );
}
