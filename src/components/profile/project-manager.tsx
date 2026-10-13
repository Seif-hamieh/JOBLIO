"use client";

import { useI18n } from "@/i18n/client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, m } from "motion/react";
import { ExternalLink, FolderGit2, ImagePlus, Pencil, Plus, Star, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/misc";
import { toast } from "@/components/ui/toast";
import { acceptFor, checkUpload } from "@/lib/upload-check";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SkillSearch } from "@/components/skills/skill-search";
import { deleteProjectAction, uploadProjectImageAction, upsertProjectAction } from "@/server/actions/profile";

export type ProjectItem = {
  id: string;
  title: string;
  summary: string | null;
  description: string | null;
  url: string | null;
  repoUrl: string | null;
  imageUrl: string | null;
  startDate: Date | null;
  endDate: Date | null;
  featured: boolean;
  skills: { id: string; name: string }[];
};

const month = (d: Date | null) => (d ? new Date(d).toISOString().slice(0, 7) : "");
const empty = { title: "", summary: "", description: "", url: "", repoUrl: "", imageUrl: "", startDate: "", endDate: "", featured: false, skills: [] as { id: string; name: string }[] };

export function ProjectManager({ items }: { items: ProjectItem[] }) {
  const router = useRouter();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | undefined>();
  const [v, setV] = useState(empty);
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [pending, start] = useTransition();
  const [uploading, startUpload] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const edit = (p?: ProjectItem) => {
    setEditId(p?.id);
    setErrors({});
    setV(
      p
        ? { title: p.title, summary: p.summary ?? "", description: p.description ?? "", url: p.url ?? "", repoUrl: p.repoUrl ?? "", imageUrl: p.imageUrl ?? "", startDate: month(p.startDate), endDate: month(p.endDate), featured: p.featured, skills: p.skills }
        : empty,
    );
    setOpen(true);
  };

  // Deleting a project can't be undone, so it is confirmed first.
  const [deleting, setDeleting] = useState<ProjectItem | null>(null);
  const remove = () =>
    start(async () => {
      const target = deleting;
      setDeleting(null);
      if (!target) return;
      const res = await deleteProjectAction(target.id).catch(() => null);
      if (res?.ok) {
        toast.success(t("msg.projectRemoved"));
        router.refresh();
      } else toast.error(res && !res.ok ? res.error : t("common.somethingWrong"));
    });

  const save = () =>
    start(async () => {
      const res = await upsertProjectAction({ ...v, id: editId, skillIds: v.skills.map((s) => s.id) });
      if (res?.ok) {
        toast.success(res.message ?? t("common.saved"));
        setOpen(false);
        router.refresh();
      } else {
        setErrors(res && !res.ok ? (res.fieldErrors ?? {}) : {});
        toast.error(res && !res.ok ? res.error : t("common.somethingWrong"));
      }
    });

  return (
    <div>
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={t("profileEdit.deleteEntryTitle", { name: deleting?.title ?? "" })}
        description={t("profileEdit.deleteEntryBody")}
        confirmLabel={t("common.delete")}
        onConfirm={remove}
        loading={pending}
      />
      <div className="mb-4 flex justify-end">
        <Button onClick={() => edit()}>
          <Plus /> {t("profileEdit.addProject")}
        </Button>
      </div>
      {items.length === 0 ? (
        <EmptyState icon={<FolderGit2 />} title={t("profileEdit.projectEmpty")} description={t("profileEdit.projectEmptyBody")} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence initial={false}>
            {items.map((p) => (
              <m.article key={p.id} layout initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="surface surface-hover group overflow-hidden">
                <div className="relative aspect-[16/9] bg-gradient-to-br from-brand/30 via-aurora/20 to-mint/20 rtl:bg-gradient-to-bl">
                  {p.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.imageUrl} alt="" className="size-full object-cover" loading="lazy" />
                  )}
                  {p.featured && (
                    <span className="absolute start-3 top-3 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-medium text-white">
                      <Star className="size-3 fill-current" /> {t("common.featured")}
                    </span>
                  )}
                  <div className="absolute end-2 top-2 flex gap-1 opacity-0 transition group-focus-within:opacity-100 group-hover:opacity-100">
                    <Button size="icon-sm" variant="outline" onClick={() => edit(p)} aria-label={t("profileEdit.editProject")}>
                      <Pencil />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="outline"
                      aria-label={t("common.delete")}
                      onClick={() => setDeleting(p)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="font-semibold">{p.title}</h3>
                  {p.summary && <p className="mt-1 line-clamp-2 text-sm text-fg-muted">{p.summary}</p>}
                  <div className="mt-3 flex flex-wrap gap-1">
                    {p.skills.map((s) => (
                      <span key={s.id} className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] text-fg-muted">
                        {s.name}
                      </span>
                    ))}
                  </div>
                  {p.url && (
                    <a href={p.url} target="_blank" rel="noopener noreferrer nofollow" className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-brand-soft-fg hover:underline">
                      <ExternalLink className="size-3.5" /> {t("profileEdit.visit")}
                    </a>
                  )}
                </div>
              </m.article>
            ))}
          </AnimatePresence>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen} title={editId ? t("profileEdit.editProject") : t("profileEdit.addProject")} size="lg" footer={<Button loading={pending} onClick={save}>{t("profileEdit.saveProject")}</Button>}>
        <div className="space-y-4">
          <div
            className="relative flex aspect-[16/7] items-center justify-center overflow-hidden rounded-2xl border border-dashed border-border-strong bg-surface-2 bg-cover bg-center"
            style={v.imageUrl ? { backgroundImage: `url(${v.imageUrl})` } : undefined}
          >
            <input
              ref={fileRef}
              type="file"
              accept={acceptFor("image")}
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                const problem = checkUpload(file, "image", t);
                if (problem) return toast.error(problem);
                startUpload(async () => {
                  const fd = new FormData();
                  fd.set("file", file);
                  const res = await uploadProjectImageAction(fd).catch(() => null);
                  if (res?.ok && res.data) setV((x) => ({ ...x, imageUrl: res.data!.url }));
                  else toast.error(res && !res.ok ? res.error : t("msg.uploadFailed"));
                });
              }}
            />
            <Button variant="outline" size="sm" loading={uploading} onClick={() => fileRef.current?.click()}>
              <ImagePlus /> {v.imageUrl ? t("profileEdit.changeImage") : t("profileEdit.addCoverImage")}
            </Button>
          </div>
          <Field label={t("profileEdit.projectTitle")} error={errors.title}>
            {(p) => <Input {...p} value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} maxLength={100} />}
          </Field>
          <Field label={t("profileEdit.summary")} optional>
            {(p) => <Input {...p} value={v.summary} onChange={(e) => setV({ ...v, summary: e.target.value })} maxLength={200} />}
          </Field>
          <Field label={t("profileEdit.description")} optional>
            {(p) => <Textarea {...p} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} maxLength={3000} placeholder={t("profileEdit.projectDescPh")} />}
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("profileEdit.liveUrl")} optional error={errors.url}>
              {(p) => <Input {...p} type="url" value={v.url} onChange={(e) => setV({ ...v, url: e.target.value })} placeholder="https://" />}
            </Field>
            <Field label={t("profileEdit.repo")} optional error={errors.repoUrl}>
              {(p) => <Input {...p} type="url" value={v.repoUrl} onChange={(e) => setV({ ...v, repoUrl: e.target.value })} placeholder="https://" />}
            </Field>
            <Field label={t("profileEdit.started")} optional>
              {(p) => <Input {...p} type="month" value={v.startDate} onChange={(e) => setV({ ...v, startDate: e.target.value })} />}
            </Field>
            <Field label={t("profileEdit.finished")} optional>
              {(p) => <Input {...p} type="month" value={v.endDate} onChange={(e) => setV({ ...v, endDate: e.target.value })} />}
            </Field>
          </div>
          <div>
            <div className="mb-1.5 text-[13px] font-medium">{t("profileEdit.skillsUsed")}</div>
            <SkillSearch exclude={v.skills.map((s) => s.id)} onSelect={(s) => v.skills.length < 12 && setV({ ...v, skills: [...v.skills, { id: s.id, name: s.name }] })} />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {v.skills.map((s) => (
                <button key={s.id} type="button" onClick={() => setV({ ...v, skills: v.skills.filter((x) => x.id !== s.id) })} className="inline-flex items-center gap-1 rounded-lg bg-brand-soft px-2 py-1 text-xs font-medium text-brand-soft-fg">
                  {s.name} <X className="size-3" />
                </button>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={v.featured} onChange={(e) => setV({ ...v, featured: e.target.checked })} className="size-4 accent-[var(--brand)]" />
            {t("profileEdit.featureProject")}
          </label>
        </div>
      </Dialog>
    </div>
  );
}
