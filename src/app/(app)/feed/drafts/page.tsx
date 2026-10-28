import { getI18n, pageTitle } from "@/i18n/server";
import Link from "next/link";
import { FileText, ImageIcon, Pencil, PenLine } from "lucide-react";
import { requireViewer } from "@/server/session";
import { listDrafts } from "@/server/services/post-drafts";
import { DeleteDraftButton } from "@/components/feed/delete-draft-button";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/misc";

export const generateMetadata = pageTitle("feed.yourDrafts");

export default async function DraftsPage() {
  const [viewer, { t, f }] = await Promise.all([requireViewer(), getI18n()]);
  const drafts = await listDrafts(viewer.id);
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title={t("feed.yourDrafts")}
        description={t("feed.draftsSub")}
        actions={
          <Button asChild pill>
            <Link href="/feed/new">
              <PenLine className="size-4" /> {t("feed.createPost")}
            </Link>
          </Button>
        }
      />
      {drafts.length === 0 ? (
        <EmptyState icon={<FileText />} title={t("feed.noDrafts")} description={t("feed.noDraftsBody")} />
      ) : (
        <ul className="space-y-3">
          {drafts.map((d) => (
            <li key={d.id} className="surface flex items-start gap-4 p-4">
              <div className="min-w-0 flex-1">
                <p className="line-clamp-3 whitespace-pre-line text-[15px]">{d.content || <span className="text-fg-subtle">{t("feed.emptyDraft")}</span>}</p>
                <div className="mt-2 flex items-center gap-3 text-xs text-fg-subtle">
                  <span>{t("feed.draftUpdated", { date: f.date(d.updatedAt, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) })}</span>
                  {d.mediaUrls.length > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <ImageIcon className="size-3.5" /> {d.mediaUrls.length}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button asChild variant="outline" size="sm" pill>
                  <Link href={`/feed/new?draft=${d.id}`}>
                    <Pencil className="size-3.5" /> {t("feed.editDraft")}
                  </Link>
                </Button>
                <DeleteDraftButton id={d.id} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
