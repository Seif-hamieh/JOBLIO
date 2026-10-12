import { Mail } from "lucide-react";
import { getI18n } from "@/i18n/server";
import { StaticPageView, staticPageMetadata } from "@/components/marketing/static-page";

export const generateMetadata = staticPageMetadata("contact");

// The public support address. Set CONTACT_EMAIL to the mailbox you actually read.
const CONTACT_EMAIL = process.env.CONTACT_EMAIL || "support@getjoblio.app";

export default async function ContactPage() {
  const { t } = await getI18n();
  return (
    <StaticPageView id="contact">
      <a
        href={`mailto:${CONTACT_EMAIL}`}
        className="mt-8 flex items-center gap-4 rounded-3xl border border-border bg-surface p-5 shadow-soft transition hover:border-brand/40"
      >
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand-soft-fg">
          <Mail className="size-5" />
        </span>
        <span className="min-w-0">
          <span className="block text-sm text-fg-muted">{t("legal.emailUs")}</span>
          <bdi className="block truncate font-display text-lg font-semibold">{CONTACT_EMAIL}</bdi>
          <span className="mt-0.5 block text-xs text-fg-subtle">{t("legal.replyTime")}</span>
        </span>
      </a>
    </StaticPageView>
  );
}
