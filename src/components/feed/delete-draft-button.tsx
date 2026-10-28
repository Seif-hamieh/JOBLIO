"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteDraftAction } from "@/server/actions/feed";
import { toast } from "@/components/ui/toast";
import { useI18n } from "@/i18n/client";

export function DeleteDraftButton({ id }: { id: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      aria-label={t("feed.deleteDraft")}
      title={t("feed.deleteDraft")}
      className="grid size-9 place-items-center rounded-full text-fg-muted transition hover:bg-danger-soft hover:text-danger-fg disabled:opacity-50"
      onClick={() =>
        start(async () => {
          const res = await deleteDraftAction(id);
          if (res?.ok) {
            toast.success(t("msg.draftDeleted"));
            router.refresh();
          } else if (res) toast.error(res.error);
        })
      }
    >
      <Trash2 className="size-4" />
    </button>
  );
}
