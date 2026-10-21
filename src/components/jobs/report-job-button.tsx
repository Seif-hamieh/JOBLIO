"use client";

import { useState, useTransition } from "react";
import { Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Textarea } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";
import { reportJobAction } from "@/server/actions/reports";

const REASONS = ["FAKE", "SCAM", "SPAM", "OFFENSIVE", "EXPIRED", "OTHER"] as const;
type Reason = (typeof REASONS)[number];

/** "Report job" on the public job page: a reason plus optional details; open to signed-out visitors too. */
export function ReportJobButton({ jobId, className }: { jobId: string; className?: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<Reason | null>(null);
  const [details, setDetails] = useState("");
  const [pending, start] = useTransition();

  const submit = () =>
    start(async () => {
      if (!reason) return;
      const res = await reportJobAction({ jobId, reason, details });
      if (res?.ok) {
        toast.success(res.message ?? t("jobs.reportThanks"));
        setOpen(false);
        setReason(null);
        setDetails("");
      } else toast.error(res && !res.ok ? res.error : t("common.somethingWrong"));
    });

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn("inline-flex items-center gap-1.5 text-xs text-fg-subtle transition hover:text-danger-fg", className)}
      >
        <Flag className="size-3.5" aria-hidden /> {t("jobs.reportJob")}
      </button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        size="sm"
        title={t("jobs.reportTitle")}
        description={t("jobs.reportBody")}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              {t("common.cancel")}
            </Button>
            <Button variant="danger" loading={pending} disabled={!reason} onClick={submit}>
              <Flag /> {t("jobs.reportSend")}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div role="radiogroup" aria-label={t("jobs.reportReason")} className="grid gap-2">
            {REASONS.map((r) => (
              <button
                key={r}
                type="button"
                role="radio"
                aria-checked={reason === r}
                onClick={() => setReason(r)}
                className={cn(
                  "rounded-xl border px-3 py-2 text-start text-sm transition",
                  reason === r ? "border-danger/60 bg-danger-soft text-danger-fg" : "border-border hover:border-border-strong",
                )}
              >
                {t(`jobs.reportReasons.${r}`)}
              </button>
            ))}
          </div>
          <Field label={t("jobs.reportDetails")} optional>
            {(p) => <Textarea {...p} value={details} maxLength={1000} onChange={(e) => setDetails(e.target.value)} className="min-h-20" />}
          </Field>
        </div>
      </Dialog>
    </>
  );
}
