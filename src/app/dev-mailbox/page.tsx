import { notFound } from "next/navigation";
import { Inbox } from "lucide-react";
import { getI18n, pageTitle } from "@/i18n/server";
import { devMailbox, devMailboxEnabled } from "@/server/mail";
import { Logo } from "@/components/brand/logo";
import { LanguageToggle } from "@/components/layout/language-switcher";
import { ThemeToggle } from "@/components/layout/theme-toggle";

export const generateMetadata = pageTitle("devMail.title");

const URL_RE = /(https?:\/\/[^\s<>"']+)/g;

/** Development-only inbox for emails that would normally be sent over SMTP. */
export default async function DevMailboxPage() {
  if (!devMailboxEnabled()) notFound();
  const { t, f } = await getI18n();
  const emails = devMailbox();
  return (
    <div className="mx-auto min-h-dvh max-w-3xl px-5 py-6">
      <header className="flex items-center justify-between">
        <Logo />
        <div className="flex items-center gap-1">
          <LanguageToggle />
          <ThemeToggle />
        </div>
      </header>
      <h1 className="mt-10 flex items-center gap-2 font-display text-3xl font-semibold">
        <Inbox className="size-7 text-brand" /> {t("devMail.title")}
      </h1>
      <p className="mt-2 text-fg-muted">{t("devMail.sub")}</p>
      <ul className="mt-8 space-y-4">
        {emails.length === 0 && <li className="surface p-6 text-sm text-fg-muted">{t("devMail.empty")}</li>}
        {emails.map((e) => (
          <li key={e.id} className="surface p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-semibold">{e.subject}</h2>
              <span className="text-xs text-fg-subtle">{f.timeAgo(e.at)}</span>
            </div>
            <div className="mt-0.5 text-xs text-fg-muted">
              {t("devMail.to")}: <bdi>{e.to}</bdi>
            </div>
            <p dir="auto" className="mt-3 whitespace-pre-line break-words text-sm">
              {e.text.split(URL_RE).map((part, i) =>
                i % 2 === 1 ? (
                  <a key={i} href={part} className="font-medium text-brand-soft-fg underline break-all">
                    {part}
                  </a>
                ) : (
                  <span key={i}>{part}</span>
                ),
              )}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
