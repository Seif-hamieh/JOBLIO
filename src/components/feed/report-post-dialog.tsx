"use client";

import { useState, useTransition } from "react";
import { Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Textarea } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";
import { reportPostAction } from "@/server/actions/reports";

const REASONS = ["SPAM", "SCAM", "HARASSMENT", "HATE", "INAPPROPRIATE", "MISINFORMATION", "OTHER"] as const;
type Reason = (typeof REASONS)[number];

/** "Report post" from a post's menu: a reason plus optional details, reviewed in Admin → Reports. */
export function ReportPostDialog({ postId, open, onOpenChange }: { postId: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useI18n();
  const [reason, setReason] = useState<Reason | null>(null);
  const [details, setDetails] = useState("");
  const [pending, start] = useTransition();

  const submit = () =>
    start(async () => {
      if (!reason) return;
      const res = await reportPostAction({ postId, reason, details });
      if (res?.ok) {
        toast.success(res.message ?? t("feed.reportThanks"));
        onOpenChange(false);
        setReason(null);
        setDetails("");
      } else toast.error(res && !res.ok ? res.error : t("common.somethingWrong"));
    });

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="sm"
      title={t("feed.reportTitle")}
      description={t("feed.reportBody")}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            {t("common.cancel")}
          </Button>
          <Button variant="danger" loading={pending} disabled={!reason} onClick={submit}>
            <Flag /> {t("feed.reportSend")}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div role="radiogroup" aria-label={t("feed.reportReason")} className="grid gap-2">
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
              {t(`feed.reportReasons.${r}`)}
            </button>
          ))}
        </div>
        <Field label={t("feed.reportDetails")} optional>
          {(p) => <Textarea {...p} value={details} maxLength={1000} onChange={(e) => setDetails(e.target.value)} className="min-h-20" />}
        </Field>
      </div>
    </Dialog>
  );
}
