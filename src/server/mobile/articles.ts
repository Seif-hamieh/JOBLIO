import "server-only";
import { deleteStored, storeUpload, UploadError } from "@/server/storage";
import { articleSchema, excerpt, readingMinutes, type getArticle } from "@/server/services/articles";
import { mobileError } from "@/server/mobile/auth";
import { messageText } from "@/server/mobile/drafts";

// The app's side of articles: the JSON shape, and reading the multipart form the app sends to create or edit one.

type Article = NonNullable<Awaited<ReturnType<typeof getArticle>>>;

export const toArticleSummary = (a: Article) => ({
  id: a.id,
  title: a.title,
  excerpt: excerpt(a.content, 160),
  coverImage: a.coverImage,
  status: a.status,
  publishedAt: a.publishedAt?.toISOString() ?? null,
  updatedAt: a.updatedAt.toISOString(),
  minutes: readingMinutes(a.content),
  author: {
    id: a.author.id,
    name: a.author.name,
    image: a.author.image,
    username: a.author.username,
    headline: a.author.profile?.headline ?? null,
  },
});

export const toArticle = (a: Article) => ({
  ...toArticleSummary(a),
  content: a.content,
});

/**
 * Reads multipart: title, content, status (DRAFT | PUBLISHED), cover? (an image), removeCover? ("1"). Returns the
 * fields and the cover change (a newly stored image, null to remove, undefined to keep), or an error response.
 */
export async function readArticleForm(req: Request, userId: string) {
  const form = await req.formData().catch(() => null);
  if (!form)
    return {
      error: mobileError(400, "INVALID_BODY", "Send the article as multipart form data."),
    };
  const parsed = articleSchema.safeParse({
    title: form.get("title") ?? "",
    content: form.get("content") ?? "",
    status: form.get("status") ?? "DRAFT",
  });
  if (!parsed.success)
    return {
      error: mobileError(400, "INVALID_FIELDS", messageText(parsed.error.issues[0]?.message ?? "@v.articleTitle")),
    };
  if (parsed.data.status === "PUBLISHED" && !parsed.data.content)
    return {
      error: mobileError(400, "INVALID_FIELDS", messageText("@v.writeSomething")),
    };
  let cover: string | null | undefined = form.get("removeCover") === "1" ? null : undefined;
  const file = form.get("cover");
  if (file instanceof File && file.size > 0) {
    try {
      cover = (await storeUpload(file, "post", userId)).url;
    } catch (e) {
      if (e instanceof UploadError)
        return {
          error: mobileError(400, "INVALID_IMAGE", messageText(e.message)),
        };
      throw e;
    }
  }
  return {
    d: parsed.data,
    cover,
    discard: () => (cover ? deleteStored([cover]) : Promise.resolve()),
  };
}
