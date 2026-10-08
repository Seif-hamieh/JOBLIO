"use client";

import { useI18n } from "@/i18n/client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Clock, UserPlus, UserCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { connectAction, removeConnectionAction, respondConnectionAction } from "@/server/actions/network";
import type { ActionState } from "@/server/action";

export type RelationState = "self" | "connected" | "pending-out" | "pending-in" | "none";

export function ConnectButton({
  userId,
  name,
  state: initial,
  connectionId,
  size = "sm",
  className,
  signedIn = true,
}: {
  userId: string;
  name: string;
  state: RelationState;
  connectionId?: string;
  size?: "sm" | "md";
  className?: string;
  signedIn?: boolean;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const [state, setState] = useState(initial);
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");

  const run = (fn: () => Promise<ActionState>, next: RelationState) =>
    start(async () => {
      const prev = state;
      setState(next);
      const res = await fn();
      if (!res?.ok) {
        setState(prev);
        toast.error(res && !res.ok ? res.error : t("common.somethingWrong"));
      } else if (res.message) toast.success(res.message);
    });

  if (state === "self") return null;
  if (!signedIn) {
    return (
      <Button size={size} variant="outline" pill className={className} onClick={() => router.push("/login")}>
        <UserPlus /> {t("network.connect")}
      </Button>
    );
  }
  if (state === "connected") {
    return (
      <Button size={size} variant="outline" pill className={className} disabled={pending} onClick={() => run(() => removeConnectionAction(userId), "none")} title={t("network.removeConnection")}>
        <UserCheck /> {t("network.connected")}
      </Button>
    );
  }
  if (state === "pending-out") {
    return (
      <Button size={size} variant="outline" pill className={className} disabled={pending} onClick={() => run(() => removeConnectionAction(userId), "none")} title={t("network.withdrawRequest")}>
        <Clock /> {t("network.pending")}
      </Button>
    );
  }
  if (state === "pending-in" && connectionId) {
    return (
      <div className={`flex gap-1.5 ${className ?? ""}`}>
        <Button size={size} pill loading={pending} onClick={() => run(() => respondConnectionAction(connectionId, true), "connected")}>
          <Check /> {t("network.accept")}
        </Button>
        <Button size={size} variant="ghost" pill disabled={pending} onClick={() => run(() => respondConnectionAction(connectionId, false), "none")} aria-label={t("network.ignore")}>
          <X />
        </Button>
      </div>
    );
  }
  return (
    <>
      <Button size={size} variant="soft" pill className={className} loading={pending} onClick={() => setOpen(true)}>
        <UserPlus /> {t("network.connect")}
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        size="sm"
        title={t("network.connectWith", { name })}
        description={t("network.connectNote")}
        footer={
          <Button
            onClick={() => {
              setOpen(false);
              run(() => connectAction(userId, note || undefined), "pending-out");
            }}
          >
            {t("network.sendRequest")}
          </Button>
        }
      >
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder={t("network.notePlaceholder")} className="min-h-24" />
        <div className="mt-1 text-end text-xs text-fg-subtle">{note.length}/300</div>
      </Dialog>
    </>
  );
}
