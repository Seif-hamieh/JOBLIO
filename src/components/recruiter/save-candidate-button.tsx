"use client";

import { useI18n } from "@/i18n/client";
import { useOptimistic, useTransition } from "react";
import { BookmarkCheck, BookmarkPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { toggleSaveCandidateAction } from "@/server/actions/recruiter";

export function SaveCandidateButton({ candidateId, saved }: { candidateId: string; saved: boolean }) {
  const { t } = useI18n();
  const [optimistic, setOptimistic] = useOptimistic(saved);
  const [, start] = useTransition();
  return (
    <Button
      size="sm"
      pill
      variant={optimistic ? "soft" : "ghost"}
      onClick={() =>
        start(async () => {
          setOptimistic(!optimistic);
          const res = await toggleSaveCandidateAction(candidateId);
          if (res?.ok) toast.success(res.message ?? t("common.saved"));
          else toast.error(res && !res.ok ? res.error : t("common.somethingWrong"));
        })
      }
      aria-pressed={optimistic}
    >
      {optimistic ? <BookmarkCheck /> : <BookmarkPlus />}
      {optimistic ? t("recruiter.saved") : t("recruiter.save")}
    </Button>
  );
}
