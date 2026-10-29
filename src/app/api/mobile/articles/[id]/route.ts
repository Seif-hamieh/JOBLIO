import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { LIMITS, rateLimit } from "@/server/rate-limit";
import { deleteArticle, getArticle, updateArticle } from "@/server/services/articles";
import { getMobileSession, mobileError } from "@/server/mobile/auth";
import { readArticleForm, toArticle } from "@/server/mobile/articles";

export const dynamic = "force-dynamic";

const notFound = () => mobileError(404, "NOT_FOUND", "That article no longer exists.");

// GET /api/mobile/articles/:id  →  { article }  (with its full text; drafts only for their author)
export async function GET(req: Request, { params }: RouteContext<"/api/mobile/articles/[id]">) {
  const session = await getMobileSession(req);
  if (!session) return mobileError(401, "UNAUTHORIZED", "Sign in first.");
  const article = await getArticle(session.user.id, (await params).id.slice(0, 40));
  if (!article) return notFound();
  return NextResponse.json({ article: toArticle(article) }, { headers: { "Cache-Control": "no-store" } });
}

// PUT /api/mobile/articles/:id  (multipart: title, content, status, cover?, removeCover?)  →  { article }
export async function PUT(req: Request, { params }: RouteContext<"/api/mobile/articles/[id]">) {
  const session = await getMobileSession(req);
  if (!session) return mobileError(401, "UNAUTHORIZED", "Sign in first.");
  const userId = session.user.id;
  if (!rateLimit(`${LIMITS.write.key}:${userId}`, LIMITS.write.max, LIMITS.write.windowMs).ok) return mobileError(429, "RATE_LIMITED", "Slow down a little.");
  const r = await readArticleForm(req, userId);
  if ("error" in r) return r.error;
  const id = (await params).id.slice(0, 40);
  const article = await updateArticle(userId, id, r.d, r.cover);
  if (!article) {
    await r.discard();
    return notFound();
  }
  revalidatePath(`/articles/${id}`);
  revalidatePath(`/in/${article.author.username}`);
  return NextResponse.json({ article: toArticle(article) }, { headers: { "Cache-Control": "no-store" } });
}

// DELETE /api/mobile/articles/:id  →  204
export async function DELETE(req: Request, { params }: RouteContext<"/api/mobile/articles/[id]">) {
  const session = await getMobileSession(req);
  if (!session) return mobileError(401, "UNAUTHORIZED", "Sign in first.");
  if (!(await deleteArticle(session.user.id, (await params).id.slice(0, 40)))) return notFound();
  revalidatePath("/articles");
  return new NextResponse(null, {
    status: 204,
    headers: { "Cache-Control": "no-store" },
  });
}
