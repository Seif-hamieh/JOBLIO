"use client";

import { useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { useI18n } from "@/i18n/client";
import { revalidatePathAction } from "@/server/actions/admin";

export function RevalidateButton({ path, label }: { path: string; label: string }) {
  const { t } = useI18n();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      size="sm"
      loading={pending}
      onClick={() =>
        start(async () => {
          const res = await revalidatePathAction(path);
          if (res?.ok) toast.success(res.message ?? label);
          else toast.error(res && !res.ok ? res.error : t("common.somethingWrong"));
        })
      }
    >
      <RefreshCw /> {label}
    </Button>
  );
}
