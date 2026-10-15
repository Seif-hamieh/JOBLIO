import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { getI18n } from "@/i18n/server";
import type { TKey } from "@/i18n/translate";

const COLUMNS: { title: TKey | "JOBLIO"; links: { href: string; label: TKey }[] }[] = [
  {
    title: "footer.professionals",
    links: [
      { href: "/jobs", label: "footer.findJobs" },
      { href: "/jobs/for-you", label: "footer.jobsForYou" },
      { href: "/companies", label: "footer.exploreCompanies" },
      { href: "/premium", label: "nav.premium" },
    ],
  },
  {
    title: "footer.employers",
    links: [
      { href: "/register?intent=RECRUITER", label: "footer.postJob" },
      { href: "/recruiter/candidates", label: "footer.searchTalent" },
      { href: "/premium", label: "nav.pricing" },
      { href: "/jobs/featured", label: "footer.featuredJobs" },
    ],
  },
  {
    title: "JOBLIO",
    links: [
      { href: "/about", label: "legal.about" },
      { href: "/#how-matching-works", label: "footer.howMatching" },
      { href: "/professionals/featured", label: "footer.featuredProfessionals" },
      { href: "/premium", label: "nav.pricing" },
      { href: "/contact", label: "legal.contact" },
    ],
  },
];

/** One line of essential links, for signed-in pages where the full footer would get in the way. */
export async function CompactFooter() {
  const { t } = await getI18n();
  const links = [
    { href: "/about", label: t("legal.about") },
    { href: "/terms", label: t("legal.terms") },
    { href: "/privacy", label: t("legal.privacy") },
    { href: "/refunds", label: t("legal.refunds") },
    { href: "/contact", label: t("legal.contact") },
  ];
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-5 gap-y-1 px-4 py-4 text-xs text-fg-subtle sm:px-6">
        <span>{t("footer.rights", { year: new Date().getFullYear() })}</span>
        <nav aria-label={t("legal.footerNav")} className="flex flex-wrap gap-x-4">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="inline-flex min-h-11 items-center hover:text-fg md:min-h-0">
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}

export async function SiteFooter() {
  const { t } = await getI18n();
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          <Logo />
          <p className="mt-4 max-w-xs text-sm text-fg-muted">{t("footer.tagline")}</p>
          <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-surface-2 px-3 py-1.5 text-xs text-fg-muted">
            <span className="size-1.5 rounded-full bg-mint" /> {t("common.noAi")}
          </p>
        </div>
        {COLUMNS.map((col) => (
          <div key={col.title}>
            <h2 className="text-sm font-semibold">{col.title === "JOBLIO" ? "JOBLIO" : t(col.title)}</h2>
            <ul className="mt-2 md:mt-3 md:space-y-2">
              {col.links.map((l) => (
                <li key={l.href + l.label}>
                  <Link href={l.href} className="inline-flex min-h-11 items-center text-sm text-fg-muted transition hover:text-fg md:min-h-0">
                    {t(l.label)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-6 text-xs text-fg-subtle sm:flex-row sm:justify-between sm:px-6">
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span>{t("footer.rights", { year: new Date().getFullYear() })}</span>
            <Link href="/terms" className="inline-flex min-h-11 items-center hover:text-fg md:min-h-0">
              {t("legal.terms")}
            </Link>
            <Link href="/privacy" className="inline-flex min-h-11 items-center hover:text-fg md:min-h-0">
              {t("legal.privacy")}
            </Link>
            <Link href="/refunds" className="inline-flex min-h-11 items-center hover:text-fg md:min-h-0">
              {t("legal.refunds")}
            </Link>
          </span>
          <span>{t("footer.freeLine")}</span>
        </div>
      </div>
    </footer>
  );
}
