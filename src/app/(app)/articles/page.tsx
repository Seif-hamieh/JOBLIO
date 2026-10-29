import { getI18n, pageTitle } from "@/i18n/server";
import Link from "next/link";
import { Newspaper, PenLine } from "lucide-react";
import { requireViewer } from "@/server/session";
import { listArticles } from "@/server/services/articles";
import { ArticleCard } from "@/components/articles/article-card";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/misc";

export const generateMetadata = pageTitle("articles.myArticles");

/** Your articles — drafts and published — newest edit first. */
export default async function MyArticlesPage() {
  const [viewer, { t }] = await Promise.all([requireViewer(), getI18n()]);
  const articles = await listArticles(viewer.id, viewer.id, 200);
  const write = (
    <Button asChild pill>
      <Link href="/articles/new">
        <PenLine className="size-4" /> {t("articles.write")}
      </Link>
    </Button>
  );
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title={t("articles.myArticles")} description={t("articles.myArticlesSub")} actions={write} />
      {articles.length === 0 ? (
        <EmptyState icon={<Newspaper />} title={t("articles.none")} description={t("articles.noneSelf")} action={write} />
      ) : (
        <div className="space-y-3">
          {articles.map((a) => (
            <ArticleCard key={a.id} article={a} />
          ))}
        </div>
      )}
    </div>
  );
}
