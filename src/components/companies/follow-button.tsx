"use client";

import { useI18n } from "@/i18n/client";
import { useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { toggleFollowCompany } from "@/server/actions/companies";

export function FollowCompanyButton({ companyId, following, signedIn, size = "md", className }: { companyId: string; following: boolean; signedIn: boolean; size?: "sm" | "md" | "lg"; className?: string }) {
  const router = useRouter();
  const { t } = useI18n();
  const [optimistic, setOptimistic] = useOptimistic(following);
  const [, start] = useTransition();
  return (
    <Button
      size={size}
      pill
      variant={optimistic ? "outline" : "secondary"}
      className={className}
      onClick={() => {
        if (!signedIn) return router.push("/login");
        start(async () => {
          setOptimistic(!optimistic);
          const res = await toggleFollowCompany(companyId);
          if (!res?.ok) toast.error(res && !res.ok ? res.error : t("common.somethingWrong"));
        });
      }}
    >
      {optimistic ? <Check /> : <Plus />}
      {optimistic ? t("common.following") : t("common.follow")}
    </Button>
  );
}
