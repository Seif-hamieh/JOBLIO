"use client";

import { useI18n } from "@/i18n/client";
import { useTransition } from "react";
import { CheckCircle2, MoreHorizontal, XCircle } from "lucide-react";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/menu";
import { toast } from "@/components/ui/toast";
import { updateInterviewStatusAction } from "@/server/actions/interviews";

export function InterviewStatusMenu({ interviewId }: { interviewId: string }) {
  const [pending, start] = useTransition();
  const { t } = useI18n();
  const set = (s: "COMPLETED" | "CANCELLED") =>
    start(async () => {
      const res = await updateInterviewStatusAction(interviewId, s);
      if (res?.ok) toast.success(s === "COMPLETED" ? t("interviews.completed") : t("interviews.cancelled"));
      else toast.error(res && !res.ok ? res.error : t("common.somethingWrong"));
    });
  return (
    <Menu>
      <MenuTrigger disabled={pending} className="rounded-full p-2 text-fg-subtle hover:bg-surface-2 hover:text-fg" aria-label={t("interviews.actions")}>
        <MoreHorizontal className="size-4" />
      </MenuTrigger>
      <MenuContent>
        <MenuItem icon={<CheckCircle2 />} onSelect={() => set("COMPLETED")}>
          {t("interviews.markCompleted")}
        </MenuItem>
        <MenuItem icon={<XCircle />} danger onSelect={() => set("CANCELLED")}>
          {t("interviews.cancel")}
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}
