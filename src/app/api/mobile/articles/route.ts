import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { LIMITS, rateLimit } from "@/server/rate-limit";
import { createArticle, listArticles } from "@/server/services/articles";
import { getMobileSession, mobileError } from "@/server/mobile/auth";
import { readArticleForm, toArticle, toArticleSummary } from "@/server/mobile/articles";

export const dynamic = "force-dynamic";

// GET /api/mobile/articles?author=USERNAME  →  { articles: [summary] }
// A member's published articles; without ?author (or with your own username), all of yours, drafts included.
export async function GET(req: Request) {
  const session = await getMobileSession(req);
  if (!session) return mobileError(401, "UNAUTHORIZED", "Sign in first.");
  const username = new URL(req.url).searchParams.get("author")?.slice(0, 60);
  let authorId = session.user.id;
  if (username) {
    const author = await db.user.findUnique({
      where: { username },
      select: { id: true },
    });
    if (!author) return mobileError(404, "NOT_FOUND", "That member does not exist.");
    authorId = author.id;
  }
  const articles = await listArticles(session.user.id, authorId, 100);
  return NextResponse.json({ articles: articles.map(toArticleSummary) }, { headers: { "Cache-Control": "no-store" } });
}

// POST /api/mobile/articles  (multipart: title, content, status, cover?)  →  201 { article }
export async function POST(req: Request) {
  const session = await getMobileSession(req);
  if (!session) return mobileError(401, "UNAUTHORIZED", "Sign in first.");
  const userId = session.user.id;
  if (!rateLimit(`${LIMITS.write.key}:${userId}`, LIMITS.write.max, LIMITS.write.windowMs).ok) return mobileError(429, "RATE_LIMITED", "Slow down a little.");
  const r = await readArticleForm(req, userId);
  if ("error" in r) return r.error;
  const article = await createArticle(userId, r.d, r.cover ?? null);
  if (!article) {
    await r.discard();
    return mobileError(409, "TOO_MANY_ARTICLES", "You have reached the limit of 200 articles.");
  }
  revalidatePath(`/in/${article.author.username}`);
  return NextResponse.json({ article: toArticle(article) }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
