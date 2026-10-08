"use client";

import { useI18n } from "@/i18n/client";
import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteSavedSearchAction } from "@/server/actions/jobs";
import { toast } from "@/components/ui/toast";

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
