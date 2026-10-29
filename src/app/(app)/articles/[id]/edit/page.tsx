import { getI18n, pageTitle } from "@/i18n/server";
import { notFound } from "next/navigation";
import { requireViewer } from "@/server/session";
import { getArticle } from "@/server/services/articles";
import { ArticleEditor } from "@/components/articles/article-editor";
import { PageHeader } from "@/components/ui/misc";

export const generateMetadata = pageTitle("articles.editArticle");

export default async function EditArticlePage({ params }: PageProps<"/articles/[id]/edit">) {
  const { id } = await params;
  const [viewer, { t }] = await Promise.all([requireViewer(), getI18n()]);
  const article = await getArticle(viewer.id, id);
  if (!article || article.author.id !== viewer.id) notFound();
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title={t("articles.editArticle")} />
      <ArticleEditor article={article} />
    </div>
  );
}
