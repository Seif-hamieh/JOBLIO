"use client";

import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Trash2, X } from "lucide-react";
import { deleteArticleAction, saveArticleAction } from "@/server/actions/articles";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { acceptFor, checkUpload } from "@/lib/upload-check";
import { useI18n } from "@/i18n/client";
import type { ActionState } from "@/server/action";

export type EditableArticle = {
  id: string;
  title: string;
  content: string;
  coverImage: string | null;
  status: "DRAFT" | "PUBLISHED";
};

/** Writing or editing an article: title, cover image, text. "Save draft" keeps it private; "Publish" puts it on the profile. */
export function ArticleEditor({ article }: { article?: EditableArticle }) {
  const { t } = useI18n();
  const router = useRouter();
  const [title, setTitle] = useState(article?.title ?? "");
  const [content, setContent] = useState(article?.content ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [removeCover, setRemoveCover] = useState(false);
  const [deleting, startDelete] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const coverInput = useRef<HTMLInputElement>(null);
  const [state, action, pending] = useActionState<ActionState<{ id: string }>, FormData>(
    (prev, form) =>
      saveArticleAction(prev, form).catch(() => ({
        ok: false as const,
        error: t("msg.uploadFailed"),
      })),
    null,
  );

  useEffect(() => {
    if (state?.ok && state.data) {
      toast.success(t(state.message === "@msg.articlePublished" ? "msg.articlePublished" : "msg.articleSaved"));
      router.push(`/articles/${state.data.id}`);
    } else if (state && !state.ok) toast.error(state.error);
  }, [state, t, router]);

  // Keep the hidden file input holding the chosen cover, so it's sent with the form.
  useEffect(() => {
    if (!coverInput.current) return;
    const dt = new DataTransfer();
    if (file) dt.items.add(file);
    coverInput.current.files = dt.files;
  }, [file]);

  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);
  const shownCover = preview ?? (removeCover ? null : (article?.coverImage ?? null));
  const busy = pending || deleting;

  return (
    <form action={action} className="space-y-5">
      {article && <input type="hidden" name="id" value={article.id} />}
      <input type="hidden" name="removeCover" value={removeCover && !file ? "1" : "0"} />
      <input ref={coverInput} type="file" name="cover" className="hidden" tabIndex={-1} aria-hidden />

      {shownCover ? (
        <div className="relative overflow-hidden rounded-2xl border border-border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={shownCover} alt="" className="aspect-[2/1] w-full object-cover" />
          <div className="absolute end-3 top-3 flex gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
              <ImagePlus className="size-4" /> {t("articles.changeCover")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              aria-label={t("articles.removeCover")}
              onClick={() => {
                setFile(null);
                setRemoveCover(true);
              }}
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex aspect-[4/1] w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border-strong text-sm text-fg-muted transition hover:bg-surface-2"
        >
          <ImagePlus className="size-5" /> {t("articles.addCover")}
        </button>
      )}
      <input
        ref={fileRef}
        type="file"
        accept={acceptFor("image")}
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          const problem = checkUpload([f], "image", t);
          if (problem) return toast.error(problem);
          setFile(f);
        }}
      />

      <Input
        name="title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={150}
        placeholder={t("articles.titlePh")}
        aria-label={t("articles.title")}
        className="h-14 font-display text-2xl font-semibold"
      />
      <div>
        <Textarea
          name="content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          maxLength={50000}
          placeholder={t("articles.contentPh")}
          aria-label={t("articles.content")}
          className="min-h-[420px] text-[16px] leading-relaxed"
        />
        <p className="mt-2 text-xs text-fg-subtle">{t("articles.formatHelp")}</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <div>
          {article && (
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => {
                if (!confirm(t("articles.deleteConfirm"))) return;
                startDelete(async () => {
                  const res = await deleteArticleAction(article.id);
                  if (res?.ok) {
                    toast.success(t("msg.articleDeleted"));
                    router.push("/articles");
                  } else if (res) toast.error(res.error);
                });
              }}
            >
              <Trash2 className="size-4" /> {t("articles.delete")}
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          {article?.status !== "PUBLISHED" && (
            <Button type="submit" name="status" value="DRAFT" variant="outline" disabled={busy || !title.trim()} pill>
              {t("articles.saveDraft")}
            </Button>
          )}
          <Button type="submit" name="status" value="PUBLISHED" loading={pending} disabled={busy || !title.trim() || !content.trim()} pill>
            {article?.status === "PUBLISHED" ? t("articles.update") : t("articles.publish")}
          </Button>
        </div>
      </div>
    </form>
  );
}
