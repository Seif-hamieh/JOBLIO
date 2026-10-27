"use client";

import { useI18n } from "@/i18n/client";
import { useTransition } from "react";
import { Bell, BellOff, Trash2 } from "lucide-react";
import { deleteSavedSearchAction, toggleJobAlertAction } from "@/server/actions/jobs";
import { toast } from "@/components/ui/toast";
import { resolveMessage } from "@/i18n/message";

/** The bell on a saved job search: turns its daily job alert on or off. */
export function ToggleJobAlert({ id, enabled }: { id: string; enabled: boolean }) {
  const [pending, start] = useTransition();
  const { t } = useI18n();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await toggleJobAlertAction(id, !enabled);
          if (res?.ok && res.message) toast.success(resolveMessage(t, res.message));
        })
      }
      className={`rounded-full p-2 transition disabled:opacity-50 ${enabled ? "text-brand-soft-fg hover:bg-brand-soft" : "text-fg-subtle hover:bg-surface-2"}`}
      aria-label={enabled ? t("jobs.alertTurnOff") : t("jobs.alertTurnOn")}
      aria-pressed={enabled}
      title={enabled ? t("jobs.alertTurnOff") : t("jobs.alertTurnOn")}
    >
      {enabled ? <Bell className="size-4" /> : <BellOff className="size-4" />}
    </button>
  );
}

export function DeleteSavedSearch({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const { t } = useI18n();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await deleteSavedSearchAction(id);
          if (res?.ok) toast.success(t("jobs.savedRemoved"));
        })
      }
      className="rounded-full p-2 text-fg-subtle transition hover:bg-danger-soft hover:text-danger-fg disabled:opacity-50"
      aria-label={t("jobs.deleteSaved")}
    >
      <Trash2 className="size-4" />
    </button>
  );
}
