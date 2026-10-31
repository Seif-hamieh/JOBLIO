"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Switch } from "@/components/ui/controls";
import { toast } from "@/components/ui/toast";
import { useI18n } from "@/i18n/client";
import { setJobPromotion } from "@/server/actions/admin";

/** Admin → Jobs: Featured / Urgent on (30 days, no payment) or off, for one job. Only open jobs can be turned on. */
export function PromotionSwitch({ jobId, kind, active, canTurnOn }: { jobId: string; kind: "FEATURED" | "URGENT"; active: boolean; canTurnOn: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Switch
      checked={active}
      disabled={pending || (!active && !canTurnOn)}
      onCheckedChange={(on) =>
        start(async () => {
          const res = await setJobPromotion(jobId, kind, on ? 30 : 0);
          if (res?.ok) {
            if (res.message) toast.success(res.message);
            router.refresh();
          } else toast.error(res && !res.ok ? res.error : t("common.somethingWrong"));
        })
      }
    />
  );
}
