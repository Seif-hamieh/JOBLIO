"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { XCircle } from "lucide-react";
import { Button, buttonClasses } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/components/ui/toast";
import { useI18n } from "@/i18n/client";
import { cancelSubscription } from "@/server/actions/admin";

export function SubscriptionActions({ sub }: { sub: { id: string; canCancel: boolean; username: string | null; email: string } }) {
  const { t } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  const cancel = () =>
    start(async () => {
      const res = await cancelSubscription(sub.id);
      if (res?.ok) {
        if (res.message) toast.success(res.message);
        setOpen(false);
        router.refresh();
      } else toast.error(res && !res.ok ? res.error : t("common.somethingWrong"));
    });

  // Members without a username have no public profile: search for them in the users list instead.
  const userHref = sub.username ? `/in/${sub.username}` : `/admin/users?q=${encodeURIComponent(sub.email)}`;

  return (
    <div className="flex items-center justify-end gap-1.5">
      <Link href={userHref} className={buttonClasses({ variant: "ghost", size: "xs" })}>
        {t("admin.subsTable.viewUser")}
      </Link>
      {sub.canCancel && (
        <Button variant="ghost" size="xs" className="text-danger-fg" onClick={() => setOpen(true)}>
          <XCircle /> {t("admin.subsTable.cancel")}
        </Button>
      )}
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={t("admin.subsTable.cancel")}
        description={t("admin.subsTable.confirmCancel")}
        confirmLabel={t("admin.subsTable.cancel")}
        loading={pending}
        onConfirm={cancel}
      />
    </div>
  );
}
