"use client";

import { useI18n } from "@/i18n/client";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, m } from "motion/react";
import { Award, Briefcase, FolderGit2, Globe2, ImagePlus, PenLine, Users, X } from "lucide-react";
import { createPostAction } from "@/server/actions/feed";
import { Avatar, CompanyLogo } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { acceptFor, checkUpload } from "@/lib/upload-check";
import type { ActionState } from "@/server/action";

type Option = { id: string; title: string };

const TYPES = [
  { value: "UPDATE", label: "feed.typeUpdate", icon: PenLine },
  { value: "ACHIEVEMENT", label: "feed.typeAchievement", icon: Award },
  { value: "PROJECT", label: "feed.typeProject", icon: FolderGit2 },
  { value: "JOB", label: "feed.typeJob", icon: Briefcase },
] as const;

export function Composer({
  viewer,
  projects,
  jobs,
  company,
  defaultOpen = false,
  inline = true,
}: {
  viewer: { name: string; image: string | null };
  projects: Option[];
  jobs: Option[];
  company: { name: string; logoUrl: string | null } | null;
  defaultOpen?: boolean;
  inline?: boolean;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(defaultOpen);
  const [type, setType] = useState<(typeof TYPES)[number]["value"]>("UPDATE");
  const [visibility, setVisibility] = useState<"PUBLIC" | "CONNECTIONS">("PUBLIC");
  const [asCompany, setAsCompany] = useState(false);
  const [content, setContent] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [state, action, pending] = useActionState<ActionState, FormData>(
    (prev, form) => createPostAction(prev, form).catch(() => ({ ok: false as const, error: t("msg.uploadFailed") })),
    null,
  );
  const addFiles = (input: HTMLInputElement) => {
    const next = [...files, ...Array.from(input.files ?? [])].slice(0, 4);
    input.value = "";
    // All images go up in one request, so they share the size limit.
    const problem = checkUpload(next, "image", t);
    if (problem) return toast.error(problem);
    setFiles(next);
  };
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state?.ok) {
      toast.success(t("feed.posted"));
      setOpen(false);
      setContent("");
      setFiles([]);
      setType("UPDATE");
    } else if (state && !state.ok) toast.error(state.error);
  }, [state, t]);

  const previews = useMemo(() => files.map((f) => ({ name: f.name, url: URL.createObjectURL(f) })), [files]);
  useEffect(() => () => previews.forEach((p) => URL.revokeObjectURL(p.url)), [previews]);
  const availableTypes = TYPES.filter((o) => (o.value === "JOB" ? jobs.length > 0 : o.value === "PROJECT" ? projects.length > 0 : true));

  return (
    <>
      {inline && (
        <div className="surface p-4">
          <div className="flex items-center gap-3">
            <Avatar name={viewer.name} src={viewer.image} size="md" />
            <button onClick={() => setOpen(true)} className="h-11 flex-1 rounded-full border border-border bg-surface-2 px-5 text-start text-sm text-fg-subtle transition hover:border-border-strong hover:bg-surface">
              {t("feed.composerPrompt")}
            </button>
          </div>
          <div className="mt-3 flex gap-1">
            {availableTypes.map((o) => (
              <button
                key={o.value}
                onClick={() => {
                  setType(o.value);
                  setOpen(true);
                }}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-medium text-fg-muted transition hover:bg-surface-2 hover:text-fg sm:text-sm"
              >
                <o.icon className="size-4" /> <span className="hidden sm:inline">{t(o.label)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen} title={t("feed.createPost")} size="lg">
        <form ref={formRef} action={action} className="space-y-4">
          <div className="flex items-center gap-3">
            {asCompany && company ? <CompanyLogo name={company.name} src={company.logoUrl} /> : <Avatar name={viewer.name} src={viewer.image} size="md" />}
            <div>
              <div className="text-sm font-semibold">{asCompany && company ? company.name : viewer.name}</div>
              <div className="mt-1 flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setVisibility(visibility === "PUBLIC" ? "CONNECTIONS" : "PUBLIC")}
                  className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-0.5 text-xs text-fg-muted hover:border-border-strong"
                >
                  {visibility === "PUBLIC" ? <Globe2 className="size-3" /> : <Users className="size-3" />}
                  {visibility === "PUBLIC" ? t("feed.anyone") : t("feed.connectionsOnly")}
                </button>
              </div>
            </div>
          </div>

          {/* Company owners/admins choose who's speaking: themselves or the company (logo + name on the post). */}
          {company && (
            <div role="radiogroup" aria-label={t("feed.postIdentity")} className="inline-flex rounded-full border border-border bg-surface-2/60 p-0.5">
              {[
                { value: false, label: t("feed.postAsUser"), icon: <Avatar name={viewer.name} src={viewer.image} size="xs" /> },
                { value: true, label: t("feed.postAsCompany", { company: company.name }), icon: <CompanyLogo name={company.name} src={company.logoUrl} size="sm" className="size-5 rounded-md text-[10px]" /> },
              ].map((o) => (
                <button
                  key={String(o.value)}
                  type="button"
                  role="radio"
                  aria-checked={asCompany === o.value}
                  onClick={() => setAsCompany(o.value)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition",
                    asCompany === o.value ? "bg-brand-soft text-brand-soft-fg shadow-sm" : "text-fg-muted hover:text-fg",
                  )}
                >
                  {o.icon}
                  <span className="max-w-40 truncate">{o.label}</span>
                </button>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {availableTypes.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => setType(o.value)}
                className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition", type === o.value ? "border-brand bg-brand-soft text-brand-soft-fg" : "border-border text-fg-muted hover:text-fg")}
              >
                <o.icon className="size-3.5" /> {t(o.label)}
              </button>
            ))}
          </div>

          <input type="hidden" name="type" value={type} />
          <input type="hidden" name="visibility" value={visibility} />
          <input type="hidden" name="asCompany" value={asCompany ? "1" : "0"} />

          <AnimatePresence initial={false}>
            {type === "PROJECT" && (
              <m.select key="p" name="projectId" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm" required>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </m.select>
            )}
            {type === "JOB" && (
              <m.select key="j" name="jobId" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm" required>
                {jobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.title}
                  </option>
                ))}
              </m.select>
            )}
          </AnimatePresence>

          <textarea
            name="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            maxLength={3000}
            autoFocus
            placeholder={
              type === "ACHIEVEMENT" ? t("feed.phAchievement") : type === "JOB" ? t("feed.phJob") : type === "PROJECT" ? t("feed.phProject") : t("feed.phUpdate")
            }
            className="min-h-40 w-full resize-none bg-transparent text-[15px] leading-relaxed outline-none placeholder:text-fg-subtle"
          />

          {previews.length > 0 && (
            <div className="grid grid-cols-4 gap-2">
              {previews.map((p, i) => (
                <div key={p.url} className="group relative aspect-square overflow-hidden rounded-xl">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt={p.name} className="size-full object-cover" />
                  <button type="button" onClick={() => setFiles((f) => f.filter((_, j) => j !== i))} className="absolute end-1 top-1 rounded-full bg-black/60 p-1 text-white" aria-label={t("common.remove")}>
                    <X className="size-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <input
            ref={fileRef}
            type="file"
            accept={acceptFor("image")}
            multiple
            className="sr-only"
            onChange={(e) => addFiles(e.target)}
          />
          {/* Files are appended at submit time so removals are respected. */}
          <FilesBridge files={files} formRef={formRef} />

          <div className="flex items-center justify-between border-t border-border pt-3">
            <button type="button" onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-fg-muted hover:bg-surface-2 hover:text-fg" disabled={files.length >= 4}>
              <ImagePlus className="size-4" /> {t("feed.photo")}
            </button>
            <div className="flex items-center gap-3">
              <span className={cn("text-xs tabular-nums", content.length > 2800 ? "text-danger-fg" : "text-fg-subtle")}>{content.length}/3000</span>
              <Button type="submit" loading={pending} disabled={!content.trim()} pill>
                {t("feed.post")}
              </Button>
            </div>
          </div>
        </form>
      </Dialog>
    </>
  );
}

/** Keeps a hidden multi-file input in sync with the selected files. */
function FilesBridge({ files, formRef }: { files: File[]; formRef: React.RefObject<HTMLFormElement | null> }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const dt = new DataTransfer();
    files.forEach((f) => dt.items.add(f));
    ref.current.files = dt.files;
  }, [files, formRef]);
  return <input ref={ref} type="file" name="media" multiple className="hidden" tabIndex={-1} aria-hidden />;
}
