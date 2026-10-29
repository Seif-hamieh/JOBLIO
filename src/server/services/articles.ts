import "server-only";
import { z } from "zod";
import { db } from "@/server/db";
import { deleteStored } from "@/server/storage";
import { isBlockedEitherWay } from "@/server/services/profile";

// Articles, shared by the website and the app. Drafts are seen only by their author; published articles by every
// member (except across a block). The text is plain paragraphs with a little Markdown (see lib/article-text).

export const MAX_ARTICLES = 200;

export const articleSchema = z.object({
  title: z.string().trim().min(1, "@v.articleTitle").max(150, "@v.articleTitle"),
  content: z.string().trim().max(50_000, "@v.articleLength"),
  status: z.enum(["DRAFT", "PUBLISHED"]),
});
export type ArticleFields = z.infer<typeof articleSchema>;

const articleSelect = {
  id: true,
  title: true,
  content: true,
  coverImage: true,
  status: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
  author: {
    select: {
      id: true,
      name: true,
      image: true,
      username: true,
      profile: { select: { headline: true } },
    },
  },
} as const;

/** A short plain-text preview of an article's text (Markdown marks removed). */
export function excerpt(content: string, max = 220) {
  const text = content
    .replace(/^#{1,3}\s+|^>\s?|^[-*]\s+/gm, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\*\*|__|\*|_/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

/** Minutes to read, at about 220 words a minute. */
export const readingMinutes = (content: string) => Math.max(1, Math.round(content.split(/\s+/).filter(Boolean).length / 220));

/** The article, if this member may read it: the author always; others only once it's published. */
export async function getArticle(viewerId: string | null, id: string) {
  const article = await db.article.findUnique({
    where: { id },
    select: articleSelect,
  });
  if (!article) return null;
  if (article.author.id === viewerId) return article;
  if (article.status !== "PUBLISHED") return null;
  if (viewerId && (await isBlockedEitherWay(viewerId, article.author.id))) return null;
  return article;
}

/** A member's articles, newest first: everything for the author themselves, otherwise only published ones. */
export async function listArticles(viewerId: string | null, authorId: string, take = 50) {
  const own = viewerId === authorId;
  if (!own && viewerId && (await isBlockedEitherWay(viewerId, authorId))) return [];
  const rows = await db.article.findMany({
    where: { authorId, ...(own ? {} : { status: "PUBLISHED" as const }) },
    orderBy: own ? { updatedAt: "desc" } : { publishedAt: "desc" },
    take,
    select: articleSelect,
  });
  return rows;
}

const statusData = (status: ArticleFields["status"], wasPublishedAt: Date | null) => ({
  status,
  // Kept from the first publish, so editing later doesn't move it to the top again.
  publishedAt: status === "PUBLISHED" ? (wasPublishedAt ?? new Date()) : wasPublishedAt,
});

/**
 * Creates an article (with an already-stored cover, or none). Null when the member has too many already.
 */
export async function createArticle(authorId: string, d: ArticleFields, coverImage: string | null) {
  if ((await db.article.count({ where: { authorId } })) >= MAX_ARTICLES) return null;
  return db.article.create({
    data: {
      authorId,
      title: d.title,
      content: d.content,
      coverImage,
      ...statusData(d.status, null),
    },
    select: articleSelect,
  });
}

/**
 * Updates one of the author's articles. `cover`: a newly stored image, null to remove it, or undefined to keep it;
 * a replaced or removed cover is deleted. Null when the article doesn't exist or isn't theirs.
 */
export async function updateArticle(authorId: string, id: string, d: ArticleFields, cover: string | null | undefined) {
  const existing = await db.article.findFirst({
    where: { id, authorId },
    select: { coverImage: true, publishedAt: true },
  });
  if (!existing) return null;
  const saved = await db.article.update({
    where: { id },
    data: {
      title: d.title,
      content: d.content,
      ...(cover !== undefined && { coverImage: cover }),
      ...statusData(d.status, existing.publishedAt),
    },
    select: articleSelect,
  });
  if (cover !== undefined && existing.coverImage && existing.coverImage !== cover) await deleteStored([existing.coverImage]);
  return saved;
}

export async function deleteArticle(authorId: string, id: string) {
  const existing = await db.article.findFirst({
    where: { id, authorId },
    select: { coverImage: true },
  });
  if (!existing) return false;
  await db.article.delete({ where: { id } });
  if (existing.coverImage) await deleteStored([existing.coverImage]);
  return true;
}
