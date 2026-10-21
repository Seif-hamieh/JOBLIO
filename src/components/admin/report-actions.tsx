"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CircleCheck, CircleSlash } from "lucide-react";
import { Button, buttonClasses } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/components/ui/toast";
import { useI18n } from "@/i18n/client";
import { resolveJobReports } from "@/server/actions/admin";

export function ReportActions({ job }: { job: { id: string; title: string; isOpen: boolean } }) {
  const { t } = useI18n();
  const router = useRouter();
  const [confirmClose, setConfirmClose] = useState(false);
  const [pending, start] = useTransition();

  const run = (close: boolean) =>
    start(async () => {
      const res = await resolveJobReports(job.id, close);
      if (res?.ok) {
        if (res.message) toast.success(res.message);
        setConfirmClose(false);
        router.refresh();
      } else toast.error(res && !res.ok ? res.error : t("common.somethingWrong"));
    });

  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      <Link href={`/jobs/${job.id}`} className={buttonClasses({ variant: "ghost", size: "xs" })}>
        {t("admin.view")}
      </Link>
      {job.isOpen && (
        <Button variant="outline" size="xs" className="text-danger-fg" disabled={pending} onClick={() => setConfirmClose(true)}>
          <CircleSlash /> {t("admin.reportsPage.closeJob")}
        </Button>
      )}
      <Button variant="ghost" size="xs" disabled={pending} onClick={() => run(false)}>
        <CircleCheck /> {t("admin.reportsPage.dismiss")}
      </Button>
      <ConfirmDialog
        open={confirmClose}
        onOpenChange={setConfirmClose}
        title={t("admin.reportsPage.closeTitle")}
        description={t("admin.reportsPage.closeBody", { title: job.title })}
        confirmLabel={t("admin.reportsPage.closeJob")}
        loading={pending}
        onConfirm={() => run(true)}
      />
    </div>
  );
}
