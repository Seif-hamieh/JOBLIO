import Link from "next/link";
import { getI18n } from "@/i18n/server";
import { Badge } from "@/components/ui/badge";
import { excerpt, readingMinutes } from "@/server/services/articles";

type Card = {
  id: string;
  title: string;
  content: string;
  coverImage: string | null;
  status: "DRAFT" | "PUBLISHED";
  publishedAt: Date | null;
  updatedAt: Date;
};

/** One article in a list: cover, title, a preview of the text, and when it was published (or "Draft"). */
export async function ArticleCard({ article }: { article: Card }) {
  const { t, f } = await getI18n();
  return (
    <Link
      href={`/articles/${article.id}`}
      className="group flex gap-4 rounded-2xl border border-border p-3 transition hover:border-border-strong hover:bg-surface-2/50"
    >
      {article.coverImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={article.coverImage} alt="" className="aspect-[4/3] w-28 shrink-0 rounded-xl object-cover sm:w-36" />
      )}
      <div className="min-w-0 flex-1 py-1">
        <h3 className="line-clamp-2 font-display font-semibold leading-snug group-hover:underline">{article.title}</h3>
        <p className="mt-1 line-clamp-2 text-sm text-fg-muted">{excerpt(article.content, 160)}</p>
        <div className="mt-2 flex items-center gap-2 text-xs text-fg-subtle">
          {article.status === "DRAFT" ? (
            <Badge>{t("articles.draft")}</Badge>
          ) : (
            <span>
              {t("articles.published", {
                date: f.date(article.publishedAt!, {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                }),
              })}
            </span>
          )}
          <span>·</span>
          <span>{t("articles.minRead", { n: readingMinutes(article.content) })}</span>
        </div>
      </div>
    </Link>
  );
}
