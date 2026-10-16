"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { BadgeCheck, BadgeX, Trash2 } from "lucide-react";
import { Button, buttonClasses } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/components/ui/toast";
import { useI18n } from "@/i18n/client";
import { deleteCompany, setCompanyVerified } from "@/server/actions/admin";
import type { ActionState } from "@/server/action";

export function CompanyActions({ company }: { company: { id: string; name: string; slug: string; verified: boolean } }) {
  const { t } = useI18n();
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, start] = useTransition();

  const run = (action: () => Promise<ActionState<unknown>>, done?: () => void) =>
    start(async () => {
      const res = await action();
      if (res?.ok) {
        if (res.message) toast.success(res.message);
        done?.();
        router.refresh();
      } else toast.error(res && !res.ok ? res.error : t("common.somethingWrong"));
    });

  return (
    <div className="flex items-center justify-end gap-1.5">
      <Link href={`/companies/${company.slug}`} className={buttonClasses({ variant: "ghost", size: "xs" })}>
        {t("admin.view")}
      </Link>
      <Button variant="outline" size="xs" disabled={pending} onClick={() => run(() => setCompanyVerified(company.id, !company.verified))}>
        {company.verified ? <BadgeX /> : <BadgeCheck />}
        {company.verified ? t("admin.companiesTable.unverify") : t("admin.companiesTable.verify")}
      </Button>
      <Button variant="ghost" size="xs" className="text-danger-fg" disabled={pending} onClick={() => setConfirmDelete(true)}>
        <Trash2 /> {t("admin.jobTable.delete")}
      </Button>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t("admin.companiesTable.deleteTitle", { name: company.name })}
        description={t("admin.companiesTable.deleteBody")}
        confirmLabel={t("admin.jobTable.delete")}
        loading={pending}
        onConfirm={() => run(() => deleteCompany(company.id), () => setConfirmDelete(false))}
      />
    </div>
  );
}
