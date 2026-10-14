"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { useI18n } from "@/i18n/client";
import { claimFreeBoost } from "@/server/actions/billing";

/** Job Seeker Pro: claims the monthly free Profile Boost and refreshes the page. */
export function ClaimFreeBoostButton() {
  const router = useRouter();
  const { t } = useI18n();
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      className="shrink-0"
      loading={pending}
      onClick={() =>
        start(async () => {
          const res = await claimFreeBoost();
          if (res?.ok) {
            toast.success(res.message ?? t("profileEdit.freeBoostClaimed"));
            router.refresh();
          } else toast.error(res && !res.ok ? res.error : t("common.somethingWrong"));
        })
      }
    >
      <Rocket /> {t("profileEdit.freeBoostCta")}
    </Button>
  );
}
