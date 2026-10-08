"use client";

import Link from "next/link";
import { Inbox } from "lucide-react";
import { useI18n } from "@/i18n/client";

/** Development only: points to the test inbox when email sending isn't configured. */
export function DevMailboxHint({ show }: { show: boolean }) {
  const { t } = useI18n();
  if (!show) return null;
  return (
    <div className="mt-6 rounded-2xl border border-aurora/30 bg-aurora-soft p-4 text-start text-sm text-aurora-fg">
      <p>{t("devMail.note")}</p>
      <Link href="/dev-mailbox" className="mt-2 inline-flex items-center gap-1.5 font-semibold underline">
        <Inbox className="size-4" /> {t("devMail.open")}
      </Link>
    </div>
  );
}