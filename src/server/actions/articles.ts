"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, parse, withViewer, type ActionState } from "@/server/action";
import { LIMITS } from "@/server/rate-limit";
import { deleteStored, storeUpload, UploadError } from "@/server/storage";
import { articleSchema, createArticle, deleteArticle, updateArticle } from "@/server/services/articles";

const id = z.string().min(1).max(40);

/**
 * Saves the article editor: a new article, or the one in "id". "status" is DRAFT (save) or PUBLISHED (publish);
 * "cover" is a new cover image, "removeCover"=1 drops the current one.
 */
export async function saveArticleAction(_prev: ActionState<{ id: string }>, form: FormData): Promise<ActionState<{ id: string }>> {
  return withViewer<{ id: string }>({ limit: LIMITS.write }, async (viewer) => {
    const parsed = parse(articleSchema, {
      title: form.get("title") ?? "",
      content: form.get("content") ?? "",
      status: form.get("status") ?? "DRAFT",
    });
    if (!parsed.success) return parsed.state;
    if (parsed.data.status === "PUBLISHED" && !parsed.data.content) return fail("@v.writeSomething");
    const rawId = form.get("id");
    const articleId = typeof rawId === "string" && rawId ? id.parse(rawId) : null;

    let cover: string | null | undefined = form.get("removeCover") === "1" ? null : undefined;
    const file = form.get("cover");
    if (file instanceof File && file.size > 0) {
      try {
        cover = (await storeUpload(file, "post", viewer.id)).url;
      } catch (e) {
        if (e instanceof UploadError) return fail(e.message);
        throw e;
      }
    }

    const saved = articleId ? await updateArticle(viewer.id, articleId, parsed.data, cover) : await createArticle(viewer.id, parsed.data, cover ?? null);
    if (!saved) {
      if (cover) await deleteStored([cover]);
      return fail(articleId ? "@msg.articleNotFound" : "@msg.tooManyArticles");
    }
    revalidatePath(`/articles/${saved.id}`);
    revalidatePath("/articles");
    if (viewer.username) revalidatePath(`/in/${viewer.username}`);
    return {
      ok: true,
      message: saved.status === "PUBLISHED" ? "@msg.articlePublished" : "@msg.articleSaved",
      data: { id: saved.id },
    };
  });
}

export async function deleteArticleAction(articleId: string): Promise<ActionState> {
  return withViewer({ limit: LIMITS.write }, async (viewer) => {
    if (!(await deleteArticle(viewer.id, id.parse(articleId)))) return fail("@msg.articleNotFound");
    revalidatePath("/articles");
    if (viewer.username) revalidatePath(`/in/${viewer.username}`);
    return { ok: true, message: "@msg.articleDeleted" };
  });
}
