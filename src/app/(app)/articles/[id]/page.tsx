import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { getViewer } from "@/server/session";
import { excerpt, getArticle, readingMinutes } from "@/server/services/articles";
import { ArticleBody } from "@/components/articles/article-body";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getI18n } from "@/i18n/server";

export async function generateMetadata({ params }: PageProps<"/articles/[id]">): Promise<Metadata> {
  const { id } = await params;
  const article = await getArticle((await getViewer())?.id ?? null, id);
  if (!article) return {};
  const description = excerpt(article.content, 160);
  return {
    title: article.title,
    description,
    openGraph: {
      type: "article",
      siteName: "JOBLIO",
      title: article.title,
      description,
      ...(article.coverImage && { images: [article.coverImage] }),
    },
  };
}

/** Reading an article: cover, title, author, then the formatted text. The author also sees Edit. */
export default async function ArticlePage({ params }: PageProps<"/articles/[id]">) {
  const { id } = await params;
  const [viewer, { t, f }] = await Promise.all([getViewer(), getI18n()]);
  const article = await getArticle(viewer?.id ?? null, id);
  if (!article) notFound();
  const own = viewer?.id === article.author.id;
  return (
    <article className="mx-auto max-w-3xl">
      {article.coverImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={article.coverImage} alt="" className="mb-8 aspect-[2/1] w-full rounded-3xl object-cover" />
      )}
      {article.status === "DRAFT" && <Badge className="mb-3">{t("articles.draft")}</Badge>}
      <h1 className="font-display text-3xl font-bold leading-tight sm:text-4xl">{article.title}</h1>
      <div className="mt-6 flex items-center gap-3 border-b border-border pb-6">
        <Link href={`/in/${article.author.username}`}>
          <Avatar name={article.author.name} src={article.author.image} size="md" />
        </Link>
        <div className="min-w-0 flex-1">
          <Link href={`/in/${article.author.username}`} className="font-semibold hover:underline">
            {article.author.name}
          </Link>
          {article.author.profile?.headline && <div className="truncate text-sm text-fg-muted">{article.author.profile.headline}</div>}
          <div className="text-xs text-fg-subtle">
            {article.publishedAt && (
              <>
                {t("articles.published", {
                  date: f.date(article.publishedAt, {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  }),
                })}{" "}
                ·{" "}
              </>
            )}
            {t("articles.minRead", { n: readingMinutes(article.content) })}
          </div>
        </div>
        {own && (
          <Button asChild variant="outline" size="sm" pill>
            <Link href={`/articles/${article.id}/edit`}>
              <Pencil className="size-3.5" /> {t("articles.edit")}
            </Link>
          </Button>
        )}
      </div>
      <div className="mt-8">
        <ArticleBody content={article.content} />
      </div>
    </article>
  );
}
