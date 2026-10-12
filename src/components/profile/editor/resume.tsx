"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, FileText, Trash2, Upload } from "lucide-react";
import { Button, buttonClasses } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { removeResumeAction, uploadResumeAction } from "@/server/actions/profile";
import { useI18n } from "@/i18n/client";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { acceptFor, checkUpload } from "@/lib/upload-check";

export type SavedResume = { url: string; name: string; updatedAt: string };

/** Upload, replace or remove the CV saved on the profile (stored privately). */
export function ResumeManager({ resume }: { resume: SavedResume | null }) {
  const router = useRouter();
  const { t, f } = useI18n();
  const input = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();

  const [confirming, setConfirming] = useState(false);
  const upload = (file: File) => {
    if (input.current) input.current.value = "";
    const problem = checkUpload(file, "cv", t);
    if (problem) return toast.error(problem);
    start(async () => {
      const fd = new FormData();
      fd.set("file", file);
      const res = await uploadResumeAction(fd).catch(() => null);
      if (res?.ok) {
        toast.success(res.message ?? t("common.saved"));
        router.refresh();
      } else toast.error(res && !res.ok ? res.error : t("msg.uploadFailed"));
    });
  };
  const remove = () =>
    start(async () => {
      const res = await removeResumeAction().catch(() => null);
      setConfirming(false);
      if (res?.ok) {
        toast.success(res.message ?? t("common.saved"));
        router.refresh();
      } else toast.error(res && !res.ok ? res.error : t("common.somethingWrong"));
    });

  return (
    <div>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t("profileEdit.removeCvTitle")}
        description={t("profileEdit.removeCvBody")}
        confirmLabel={t("common.remove")}
        onConfirm={remove}
        loading={pending}
      />
      <input
        ref={input}
        type="file"
        accept={acceptFor("cv")}
        className="sr-only"
        onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
      />
      {resume ? (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border p-3.5">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand-soft-fg">
            <FileText className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium" dir="auto">
              {resume.name}
            </div>
            <div className="text-xs text-fg-muted">{t("profileEdit.cvUpdated", { date: f.date(new Date(resume.updatedAt), { year: "numeric", month: "short", day: "numeric" }) })}</div>
          </div>
          <div className="flex gap-1.5">
            <a href={resume.url} target="_blank" rel="noopener noreferrer" className={buttonClasses({ variant: "ghost", size: "sm" })}>
              <ExternalLink /> {t("profileEdit.cvView")}
            </a>
            <Button size="sm" variant="outline" loading={pending} onClick={() => input.current?.click()}>
              <Upload /> {t("profileEdit.cvReplace")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirming(true)} disabled={pending} aria-label={t("common.remove")}>
              <Trash2 />
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={pending}
          className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-border-strong p-4 text-start transition hover:border-brand hover:bg-brand-soft/30 disabled:opacity-60"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-fg-muted">
            <Upload className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium">{pending ? t("profileEdit.cvUploading") : t("profileEdit.cvUpload")}</span>
            <span className="block text-xs text-fg-muted">{t("profileEdit.cvHint")}</span>
          </span>
        </button>
      )}
    </div>
  );
}
