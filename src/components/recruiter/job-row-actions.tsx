"use client";

import { useI18n } from "@/i18n/client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Eye, KanbanSquare, Megaphone, MoreHorizontal, Pause, Pencil, Play, Star, Trash2, XCircle } from "lucide-react";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { toast } from "@/components/ui/toast";
import { deleteJobAction, setJobStatusAction } from "@/server/actions/recruiter";
import type { JobStatus } from "@/lib/constants";

export function JobRowActions({ jobId, status }: { jobId: string; status: JobStatus }) {
  const router = useRouter();
  const { t } = useI18n();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; message?: string; error?: string } | null>) =>
    start(async () => {
      const res = await fn();
      if (res?.ok) toast.success(res.message ?? t("common.saved"));
      else toast.error(res?.error ?? t("common.somethingWrong"));
      router.refresh();
    });
  return (
    <Menu>
      <MenuTrigger disabled={pending} className="rounded-full p-2 text-fg-subtle hover:bg-surface-2 hover:text-fg" aria-label={t("recruiter.jobActions")}>
        <MoreHorizontal className="size-4" />
      </MenuTrigger>
      <MenuContent>
        <MenuItem icon={<KanbanSquare />} onSelect={() => router.push(`/recruiter/jobs/${jobId}/pipeline`)}>
          {t("jobs.openPipeline")}
        </MenuItem>
        <MenuItem icon={<Pencil />} onSelect={() => router.push(`/recruiter/jobs/${jobId}/edit`)}>
          {t("jobs.editJob")}
        </MenuItem>
        <MenuItem icon={<Eye />} onSelect={() => router.push(`/jobs/${jobId}`)}>
          {t("recruiter.viewPublic")}
        </MenuItem>
        <MenuSeparator />
        {status === "OPEN" && (
          <>
            <MenuItem icon={<Star />} onSelect={() => router.push(`/premium?product=FEATURED_JOB&target=${jobId}#business`)}>
              {t("recruiter.feature")}
            </MenuItem>
            <MenuItem icon={<Megaphone />} onSelect={() => router.push(`/premium?product=SPONSORED_JOB&target=${jobId}#business`)}>
              {t("recruiter.sponsor")}
            </MenuItem>
            <MenuItem icon={<Pause />} onSelect={() => run(() => setJobStatusAction(jobId, "PAUSED"))}>
              {t("recruiter.pause")}
            </MenuItem>
          </>
        )}
        {(status === "PAUSED" || status === "DRAFT" || status === "CLOSED") && (
          <MenuItem icon={<Play />} onSelect={() => run(() => setJobStatusAction(jobId, "OPEN"))}>
            {status === "DRAFT" ? t("recruiter.publish") : t("recruiter.reopen")}
          </MenuItem>
        )}
        {status !== "CLOSED" && (
          <MenuItem icon={<XCircle />} onSelect={() => run(() => setJobStatusAction(jobId, "CLOSED"))}>
            {t("recruiter.closeJob")}
          </MenuItem>
        )}
        <MenuSeparator />
        <MenuItem icon={<Trash2 />} danger onSelect={() => confirm(t("recruiter.confirmDelete")) && run(() => deleteJobAction(jobId))}>
          {t("common.delete")}
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}
