import { getI18n, pageTitle } from "@/i18n/server";
import { notFound } from "next/navigation";
import { requireViewer } from "@/server/session";
import { composerData } from "@/server/services/composer";
import { getDraft } from "@/server/services/post-drafts";
import { Composer } from "@/components/feed/composer";
import { PageHeader } from "@/components/ui/misc";

export const generateMetadata = pageTitle("feed.createPost");

/** Writing a post; with ?draft=ID, continuing that saved draft. */
export default async function NewPostPage({ searchParams }: PageProps<"/feed/new">) {
  const [viewer, { t }, sp] = await Promise.all([requireViewer(), getI18n(), searchParams]);
  const draftId = typeof sp.draft === "string" ? sp.draft : null;
  const [data, draft] = await Promise.all([composerData(viewer), draftId ? getDraft(viewer.id, draftId) : null]);
  if (draftId && !draft) notFound();
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title={draft ? t("feed.editingDraft") : t("feed.createPost")} description={t("feed.createPostSub")} />
      <Composer key={draft?.id ?? "new"} viewer={{ name: viewer.name, image: viewer.image }} {...data} draft={draft ?? undefined} defaultOpen={!!draft} />
    </div>
  );
}
