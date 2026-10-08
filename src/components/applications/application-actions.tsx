"use client";

import { useI18n } from "@/i18n/client";
import { useState, useTransition } from "react";
import { AnimatePresence, m } from "motion/react";
import { ChevronDown, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { withdrawAction } from "@/server/actions/jobs";
import { respondToInterviewAction } from "@/server/actions/interviews";
import { cn } from "@/lib/utils";

export function WithdrawButton({ applicationId, jobTitle }: { applicationId: string; jobTitle: string }) {
  const [open, setOpen] = useState(false);
  const { t } = useI18n();
  const [pending, start] = useTransition();
  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <Undo2 /> {t("applications.withdraw")}
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        size="sm"
        title={t("applications.withdrawTitle")}
        description={t("applications.withdrawBody", { job: jobTitle })}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {t("applications.keep")}
            </Button>
            <Button
              variant="danger"
              loading={pending}
              onClick={() =>
                start(async () => {
                  const res = await withdrawAction(applicationId);
                  if (res?.ok) {
                    toast.success(t("applications.withdrawn"));
                    setOpen(false);
                  } else toast.error(res && !res.ok ? res.error : t("common.somethingWrong"));
                })
              }
            >
              {t("applications.withdraw")}
            </Button>
          </>
        }
      />
    </>
  );
}

export function Expandable({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setOpen((o) => !o)} className="inline-flex items-center gap-1 text-xs font-medium text-fg-muted hover:text-fg" aria-expanded={open}>
        {label} <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <m.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            {children}
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function InterviewResponse({ interviewId, response }: { interviewId: string; response: "PENDING" | "ACCEPTED" | "DECLINED" }) {
  const [pending, start] = useTransition();
  const { t } = useI18n();
  if (response !== "PENDING") {
    return <span className={cn("text-xs font-semibold", response === "ACCEPTED" ? "text-mint-fg" : "text-danger-fg")}>{response === "ACCEPTED" ? t("interviews.confirmed") : t("interviews.declined")}</span>;
  }
  const respond = (r: "ACCEPTED" | "DECLINED") =>
    start(async () => {
      const res = await respondToInterviewAction(interviewId, r);
      if (res?.ok) toast.success(res.message ?? t("common.saved"));
      else toast.error(res && !res.ok ? res.error : t("common.somethingWrong"));
    });
  return (
    <div className="flex gap-2">
      <Button size="sm" variant="mint" loading={pending} onClick={() => respond("ACCEPTED")}>
        {t("interviews.accept")}
      </Button>
      <Button size="sm" variant="outline" disabled={pending} onClick={() => respond("DECLINED")}>
        {t("interviews.decline")}
      </Button>
    </div>
  );
}
