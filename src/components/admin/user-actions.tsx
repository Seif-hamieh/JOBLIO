"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ShieldCheck, ShieldOff } from "lucide-react";
import { Button, buttonClasses } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/components/ui/toast";
import { useI18n } from "@/i18n/client";
import { setUserRole } from "@/server/actions/admin";

export function UserActions({ user, isSelf }: { user: { id: string; name: string; username: string | null; isAdmin: boolean }; isSelf: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const next = user.isAdmin ? "USER" : "ADMIN";

  const confirm = () =>
    start(async () => {
      const res = await setUserRole(user.id, next);
      if (res?.ok) {
        if (res.message) toast.success(res.message);
        setOpen(false);
        router.refresh();
      } else toast.error(res && !res.ok ? res.error : t("common.somethingWrong"));
    });

  return (
    <div className="flex items-center justify-end gap-1.5">
      {user.username && (
        <Link href={`/in/${user.username}`} className={buttonClasses({ variant: "ghost", size: "xs" })}>
          {t("admin.view")}
        </Link>
      )}
      {!isSelf && (
        <Button variant={user.isAdmin ? "ghost" : "outline"} size="xs" className={user.isAdmin ? "text-danger-fg" : undefined} onClick={() => setOpen(true)}>
          {user.isAdmin ? <ShieldOff /> : <ShieldCheck />}
          {user.isAdmin ? t("admin.userTable.revokeAdmin") : t("admin.userTable.makeAdmin")}
        </Button>
      )}
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={user.isAdmin ? t("admin.userTable.revokeTitle", { name: user.name }) : t("admin.userTable.makeTitle", { name: user.name })}
        description={user.isAdmin ? t("admin.userTable.revokeBody") : t("admin.userTable.makeBody")}
        confirmLabel={user.isAdmin ? t("admin.userTable.revokeAdmin") : t("admin.userTable.makeAdmin")}
        danger={!user.isAdmin}
        loading={pending}
        onConfirm={confirm}
      />
    </div>
  );
}
