import { getI18n, pageTitle } from "@/i18n/server";
import { requireViewer } from "@/server/session";
import { ArticleEditor } from "@/components/articles/article-editor";
import { PageHeader } from "@/components/ui/misc";

export const generateMetadata = pageTitle("articles.newArticle");

export default async function NewArticlePage() {
  const [, { t }] = await Promise.all([requireViewer(), getI18n()]);
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title={t("articles.newArticle")} />
      <ArticleEditor />
    </div>
  );
}
