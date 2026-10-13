import Link from "next/link";
import { Compass } from "lucide-react";
import { getI18n } from "@/i18n/server";
import { Logo } from "@/components/brand/logo";
import { buttonClasses } from "@/components/ui/button";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("meta.notFound"), robots: { index: false } };
}

export default async function NotFound() {
  const { t } = await getI18n();
  return (
    <div className="grid min-h-dvh place-items-center px-5">
      <div className="max-w-md text-center">
        <Logo className="justify-center" />
        <div className="mx-auto mt-10 grid size-16 place-items-center rounded-2xl bg-brand-soft text-brand-soft-fg">
          <Compass className="size-7" />
        </div>
        <h1 className="mt-6 font-display text-3xl font-semibold">{t("meta.notFound")}</h1>
        <p className="mt-2 text-fg-muted">{t("meta.notFoundBody")}</p>
        <div className="mt-8 flex justify-center gap-2">
          <Link href="/" className={buttonClasses({ pill: true })}>
            {t("nav.home")}
          </Link>
          <Link href="/jobs" className={buttonClasses({ variant: "outline", pill: true })}>
            {t("footer.findJobs")}
          </Link>
        </div>
      </div>
    </div>
  );
}