"use client";

import { useI18n } from "@/i18n/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { AnimatePresence, m } from "motion/react";
import { Check, FileText, Paperclip, Send, X } from "lucide-react";
import { applyAction } from "@/server/actions/jobs";
import { Button, buttonClasses } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Avatar } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/field";
import { MatchRing } from "@/components/match/match-ring";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/toast";
import { acceptFor, checkUpload } from "@/lib/upload-check";
import type { ActionState } from "@/server/action";

export function ApplyButton({
  job,
  applicant,
  savedResume,
  matchScore,
  signedIn,
  applied,
  className,
  size = "lg",
}: {
  job: { id: string; title: string; companyName: string };
  applicant: { name: string; image: string | null; headline: string | null } | null;
  /** The CV saved on the applicant's profile, offered by default. */
  savedResume?: { name: string } | null;
  matchScore: number | null;
  signedIn: boolean;
  applied: boolean;
  className?: string;
  size?: "md" | "lg";
}) {
  const router = useRouter();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  // A rejected request (e.g. a body over Vercel's limit) throws instead of returning a result;
  // show it as a normal error rather than letting the page crash.
  const [state, action, pending] = useActionState<ActionState<{ score: number }>, FormData>(
    (prev, form) => applyAction(prev, form).catch(() => ({ ok: false as const, error: t("msg.uploadFailed") })),
    null,
  );
  const pickFile = (input: HTMLInputElement) => {
    const picked = input.files?.[0] ?? null;
    const problem = picked && checkUpload(picked, "cv", t);
    if (problem) {
      input.value = "";
      setFile(null);
      toast.error(problem);
      return;
    }
    setFile(picked);
  };
  const [file, setFile] = useState<File | null>(null);
  const [useSaved, setUseSaved] = useState(true);

  useEffect(() => {
    if (state?.ok) {
      const timer = setTimeout(() => {
        setOpen(false);
        router.refresh();
      }, 1800);
      return () => clearTimeout(timer);
    }
  }, [state, router]);

  if (!signedIn) {
    return (
      <Link href={`/login?next=/jobs/${job.id}`} className={buttonClasses({ size, className })}>
        {t("jobs.signInToApply")}
      </Link>
    );
  }
  if (applied) {
    return (
      <Link href="/applications" className={buttonClasses({ size, variant: "soft", className })}>
        <Check /> {t("jobs.appliedTrack")}
      </Link>
    );
  }

  return (
    <>
      <Button size={size} className={className} onClick={() => setOpen(true)}>
        {t("jobs.applyNow")} <Send />
      </Button>
      <Dialog open={open} onOpenChange={setOpen} title={state?.ok ? t("jobs.applicationSent") : t("jobs.applyTo", { company: job.companyName })} description={state?.ok ? undefined : job.title}>
        <AnimatePresence mode="wait">
          {state?.ok ? (
            <m.div key="ok" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="py-6 text-center">
              <m.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 15 }}
                className="relative mx-auto grid size-20 place-items-center rounded-full bg-mint text-white"
              >
                <Check className="size-10" strokeWidth={3} />
                {[...Array(8)].map((_, i) => (
                  <m.span
                    key={i}
                    className="absolute size-2 rounded-full bg-mint"
                    initial={{ x: 0, y: 0, opacity: 1 }}
                    animate={{ x: Math.cos((i / 8) * Math.PI * 2) * 56, y: Math.sin((i / 8) * Math.PI * 2) * 56, opacity: 0 }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                  />
                ))}
              </m.div>
              <p className="mt-6 font-display text-lg font-semibold">{t("jobs.inRunning")}</p>
              <p className="mt-1 text-sm text-fg-muted">{t("jobs.notifyReview", { company: job.companyName })}</p>
            </m.div>
          ) : (
            <m.form key="form" action={action} className="space-y-5">
              <input type="hidden" name="jobId" value={job.id} />
              {applicant && (
                <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface-2/60 p-3.5">
                  <Avatar name={applicant.name} src={applicant.image} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold">{applicant.name}</div>
                    <div className="truncate text-xs text-fg-muted">{applicant.headline ?? t("jobs.profileShared")}</div>
                  </div>
                  {matchScore != null && <MatchRing score={matchScore} size={44} stroke={4} />}
                </div>
              )}
              <div>
                <label htmlFor="coverLetter" className="text-[13px] font-medium">
                  {t("jobs.note")} <span className="font-normal text-fg-subtle">({t("common.optional")})</span>
                </label>
                <Textarea id="coverLetter" name="coverLetter" maxLength={4000} className="mt-1.5" placeholder={t("jobs.notePlaceholder")} />
              </div>
              <div>
                <span className="text-[13px] font-medium">
                  {t("jobs.cv")} <span className="font-normal text-fg-subtle">{t("jobs.cvHint")}</span>
                </span>
                {savedResume && !file && (
                  <label className={cn("mt-1.5 flex cursor-pointer items-center gap-3 rounded-2xl border p-3.5 transition", useSaved ? "border-brand bg-brand-soft/30" : "border-border")}>
                    <input type="checkbox" name="useSavedResume" value="1" checked={useSaved} onChange={(e) => setUseSaved(e.target.checked)} className="size-4 accent-[var(--brand)]" />
                    <FileText className="size-5 shrink-0 text-brand" />
                    <span className="min-w-0 flex-1 text-sm">
                      <span className="block font-medium">{t("jobs.useSavedCv")}</span>
                      <span className="block truncate text-xs text-fg-muted" dir="auto">
                        {savedResume.name}
                      </span>
                    </span>
                  </label>
                )}
                {savedResume && !file && <div className="mt-2 text-xs text-fg-subtle">{t("jobs.orAttachOther")}</div>}
                <label className={cn("mt-1.5 flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-border-strong p-4 transition hover:border-brand hover:bg-brand-soft/30", file && "border-solid border-brand bg-brand-soft/30")}>
                  <span className="grid size-10 place-items-center rounded-xl bg-surface-2 text-fg-muted">{file ? <FileText className="size-5" /> : <Paperclip className="size-5" />}</span>
                  <span className="min-w-0 flex-1 text-sm">
                    {file ? <span className="block truncate font-medium">{file.name}</span> : <span className="text-fg-muted">{t("jobs.attachCv")}</span>}
                  </span>
                  {file && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        setFile(null);
                        const input = document.getElementById("resume-input") as HTMLInputElement | null;
                        if (input) input.value = "";
                      }}
                      className="rounded-full p-1 hover:bg-surface-2"
                      aria-label={t("common.remove")}
                    >
                      <X className="size-4" />
                    </button>
                  )}
                  <input id="resume-input" type="file" name="resume" accept={acceptFor("cv")} className="sr-only" onChange={(e) => pickFile(e.target)} />
                </label>
              </div>
              {state && !state.ok && (
                <p role="alert" className="rounded-xl bg-danger-soft px-3.5 py-2.5 text-sm text-danger-fg">
                  {state.error}
                </p>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setOpen(false)}>
                  {t("common.cancel")}
                </Button>
                <Button type="submit" loading={pending}>
                  {t("jobs.submit")} <Send />
                </Button>
              </div>
            </m.form>
          )}
        </AnimatePresence>
      </Dialog>
    </>
  );
}
