"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Ban, Crown, ShieldCheck, ShieldOff, Undo2 } from "lucide-react";
import { PremiumDialog } from "@/components/admin/premium-dialog";
import { Button, buttonClasses } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog } from "@/components/ui/dialog";
import { Field, Textarea } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { useI18n } from "@/i18n/client";
import { setUserBanned, setUserRole } from "@/server/actions/admin";

type User = { id: string; name: string; username: string | null; isAdmin: boolean; banned: boolean };

export function UserActions({ user, isSelf }: { user: User; isSelf: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState<"role" | "ban" | "unban" | "premium" | null>(null);
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  const next = user.isAdmin ? "USER" : "ADMIN";

  const run = (action: () => ReturnType<typeof setUserRole>) =>
    start(async () => {
      const res = await action();
      if (res?.ok) {
        if (res.message) toast.success(res.message);
        setOpen(null);
        setReason("");
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
      {!user.banned && (
        <Button variant="outline" size="xs" onClick={() => setOpen("premium")}>
          <Crown /> {t("admin.premium.manage")}
        </Button>
      )}
      {!isSelf && !user.banned && (
        <Button variant={user.isAdmin ? "ghost" : "outline"} size="xs" className={user.isAdmin ? "text-danger-fg" : undefined} onClick={() => setOpen("role")}>
          {user.isAdmin ? <ShieldOff /> : <ShieldCheck />}
          {user.isAdmin ? t("admin.userTable.revokeAdmin") : t("admin.userTable.makeAdmin")}
        </Button>
      )}
      {/* Admins can't be banned: their role is removed first. */}
      {!isSelf && !user.isAdmin &&
        (user.banned ? (
          <Button variant="outline" size="xs" onClick={() => setOpen("unban")}>
            <Undo2 /> {t("admin.userTable.unban")}
          </Button>
        ) : (
          <Button variant="ghost" size="xs" className="text-danger-fg" onClick={() => setOpen("ban")}>
            <Ban /> {t("admin.userTable.ban")}
          </Button>
        ))}
      <PremiumDialog user={user} open={open === "premium"} onOpenChange={(o) => setOpen(o ? "premium" : null)} />
      <ConfirmDialog
        open={open === "role"}
        onOpenChange={(o) => setOpen(o ? "role" : null)}
        title={user.isAdmin ? t("admin.userTable.revokeTitle", { name: user.name }) : t("admin.userTable.makeTitle", { name: user.name })}
        description={user.isAdmin ? t("admin.userTable.revokeBody") : t("admin.userTable.makeBody")}
        confirmLabel={user.isAdmin ? t("admin.userTable.revokeAdmin") : t("admin.userTable.makeAdmin")}
        danger={!user.isAdmin}
        loading={pending}
        onConfirm={() => run(() => setUserRole(user.id, next))}
      />
      <ConfirmDialog
        open={open === "unban"}
        onOpenChange={(o) => setOpen(o ? "unban" : null)}
        title={t("admin.userTable.unbanTitle", { name: user.name })}
        description={t("admin.userTable.unbanBody")}
        confirmLabel={t("admin.userTable.unban")}
        danger={false}
        loading={pending}
        onConfirm={() => run(() => setUserBanned(user.id, false))}
      />
      <Dialog
        open={open === "ban"}
        onOpenChange={(o) => setOpen(o ? "ban" : null)}
        size="sm"
        title={t("admin.userTable.banTitle", { name: user.name })}
        description={t("admin.userTable.banBody")}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(null)} disabled={pending}>
              {t("common.cancel")}
            </Button>
            <Button variant="danger" loading={pending} onClick={() => run(() => setUserBanned(user.id, true, reason))}>
              <Ban /> {t("admin.userTable.ban")}
            </Button>
          </div>
        }
      >
        <Field label={t("admin.userTable.banReason")} optional>
          {(p) => <Textarea {...p} value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} className="min-h-20" />}
        </Field>
      </Dialog>
    </div>
  );
}
