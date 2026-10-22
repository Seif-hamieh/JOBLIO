import Link from "next/link";
import { Archive } from "lucide-react";
import { getI18n } from "@/i18n/server";
import { Logo } from "@/components/brand/logo";
import { buttonClasses } from "@/components/ui/button";

// Shown (with HTTP 410 Gone, set by the proxy) for a job that closed or a company page that was
// hidden. 410 tells search engines the URL was removed on purpose, so they drop it from the index
// faster than a 404 — while people following an old link still get somewhere useful.

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const kindOf = async (searchParams: Props["searchParams"]) => ((await searchParams).kind === "company" ? "company" : "job");

export async function generateMetadata({ searchParams }: Props) {
  const [{ t }, kind] = await Promise.all([getI18n(), kindOf(searchParams)]);
  return { title: kind === "company" ? t("meta.goneCompany") : t("meta.goneJob"), robots: { index: false, follow: true } };
}

export default async function Gone({ searchParams }: Props) {
  const [{ t }, kind] = await Promise.all([getI18n(), kindOf(searchParams)]);
  return (
    <div className="grid min-h-dvh place-items-center px-5">
      <div className="max-w-md text-center">
        <Logo className="justify-center" />
        <div className="mx-auto mt-10 grid size-16 place-items-center rounded-2xl bg-brand-soft text-brand-soft-fg">
          <Archive className="size-7" />
        </div>
        <h1 className="mt-6 font-display text-3xl font-semibold">{kind === "company" ? t("meta.goneCompany") : t("meta.goneJob")}</h1>
        <p className="mt-2 text-fg-muted">{kind === "company" ? t("meta.goneCompanyBody") : t("meta.goneJobBody")}</p>
        <div className="mt-8 flex justify-center gap-2">
          <Link href="/jobs" className={buttonClasses({ pill: true })}>
            {t("footer.findJobs")}
          </Link>
          <Link href="/" className={buttonClasses({ variant: "outline", pill: true })}>
            {t("nav.home")}
          </Link>
        </div>
      </div>
    </div>
  );
}
