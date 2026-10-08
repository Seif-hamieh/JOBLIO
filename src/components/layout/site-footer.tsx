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
      { href: "/premium", label: "footer.careerBoost" },
    ],
  },
  {
    title: "footer.employers",
    links: [
      { href: "/register?intent=RECRUITER", label: "footer.postJob" },
      { href: "/recruiter/candidates", label: "footer.searchTalent" },
      { href: "/premium#business", label: "footer.recruiterPro" },
      { href: "/jobs/featured", label: "footer.featuredJobs" },
    ],
  },
  {
    title: "JOBLIO",
    links: [
      { href: "/#how-matching-works", label: "footer.howMatching" },
      { href: "/professionals/featured", label: "footer.featuredProfessionals" },
      { href: "/settings/privacy", label: "nav.privacy" },
      { href: "/premium", label: "nav.pricing" },
    ],
  },
];

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
            <h4 className="text-sm font-semibold">{col.title === "JOBLIO" ? "JOBLIO" : t(col.title)}</h4>
            <ul className="mt-3 space-y-2">
              {col.links.map((l) => (
                <li key={l.href + l.label}>
                  <Link href={l.href} className="text-sm text-fg-muted transition hover:text-fg">
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
          <span>{t("footer.rights", { year: new Date().getFullYear() })}</span>
          <span>{t("footer.freeLine")}</span>
        </div>
      </div>
    </footer>
  );
}
