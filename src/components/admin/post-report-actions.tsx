"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CircleCheck, Trash2 } from "lucide-react";
import { Button, buttonClasses } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/components/ui/toast";
import { useI18n } from "@/i18n/client";
import { resolvePostReports } from "@/server/actions/admin";

/** A reported post's buttons in Admin → Reports: view it, delete it, or dismiss its reports. */
export function PostReportActions({ post }: { post: { id: string; author: string } }) {
  const { t } = useI18n();
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, start] = useTransition();

  const run = (deletePost: boolean) =>
    start(async () => {
      const res = await resolvePostReports(post.id, deletePost);
      if (res?.ok) {
        if (res.message) toast.success(res.message);
        setConfirmDelete(false);
        router.refresh();
      } else toast.error(res && !res.ok ? res.error : t("common.somethingWrong"));
    });

  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      <Link href={`/feed/${post.id}`} className={buttonClasses({ variant: "ghost", size: "xs" })}>
        {t("admin.view")}
      </Link>
      <Button variant="outline" size="xs" className="text-danger-fg" disabled={pending} onClick={() => setConfirmDelete(true)}>
        <Trash2 /> {t("admin.reportsPage.deletePost")}
      </Button>
      <Button variant="ghost" size="xs" disabled={pending} onClick={() => run(false)}>
        <CircleCheck /> {t("admin.reportsPage.dismiss")}
      </Button>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t("admin.reportsPage.deleteTitle")}
        description={t("admin.reportsPage.deleteBody", { name: post.author })}
        confirmLabel={t("admin.reportsPage.deletePost")}
        loading={pending}
        onConfirm={() => run(true)}
      />
    </div>
  );
}
