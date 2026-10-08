import { getI18n, pageTitle } from "@/i18n/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireViewer } from "@/server/session";
import { db } from "@/server/db";
import { getPost } from "@/server/services/feed";
import { isBlockedEitherWay, isConnected } from "@/server/services/profile";
import { PostCard } from "@/components/feed/post-card";

export const generateMetadata = pageTitle("meta.post");

export default async function PostPage({ params }: PageProps<"/feed/[id]">) {
  const { id } = await params;
  const [viewer, { t }] = await Promise.all([requireViewer(), getI18n()]);
  const meta = await db.post.findUnique({ where: { id }, select: { authorId: true, visibility: true } });
  if (!meta || (await isBlockedEitherWay(viewer.id, meta.authorId))) notFound();
  if (meta.visibility === "CONNECTIONS" && !(await isConnected(viewer.id, meta.authorId))) notFound();
  const post = await getPost(viewer.id, id);
  if (!post) notFound();
  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/feed" className="mb-5 inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg">
        <ArrowLeft className="size-4" /> {t("feed.backToFeed")}
      </Link>
      <PostCard post={post} viewer={{ id: viewer.id, name: viewer.name, image: viewer.image }} />
    </div>
  );
}
