import { getI18n, pageTitle } from "@/i18n/server";
import { requireViewer } from "@/server/session";
import { composerData } from "@/server/services/composer";
import { Composer } from "@/components/feed/composer";
import { PageHeader } from "@/components/ui/misc";

export const generateMetadata = pageTitle("feed.createPost");

export default async function NewPostPage() {
  const [viewer, { t }] = await Promise.all([requireViewer(), getI18n()]);
  const data = await composerData(viewer);
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title={t("feed.createPost")} description={t("feed.createPostSub")} />
      <Composer viewer={{ name: viewer.name, image: viewer.image }} {...data} />
    </div>
  );
}
