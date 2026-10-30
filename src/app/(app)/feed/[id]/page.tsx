import type { Metadata } from "next";
import { getI18n } from "@/i18n/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { ArrowLeft } from "lucide-react";
import { getViewer } from "@/server/session";
import { db } from "@/server/db";
import { getPost } from "@/server/services/feed";
import { isBlockedEitherWay, isConnected } from "@/server/services/profile";
import { PostCard } from "@/components/feed/post-card";
import { PublicPost } from "@/components/feed/public-post";
import { jsonLdScript } from "@/lib/job-posting-ld";
import { postHeadline, postJsonLd } from "@/lib/post-ld";
import { APP_URL } from "@/lib/utils";

// One post. Members see it as in the feed (connections-only posts only if connected). Signed-out visitors and
// search engines see public posts only, read-only, with structured data; anything else is a 404 (src/proxy.ts
// answers that before the page streams).

/** Who may see the post: its visibility and author (and, for members, blocks and connections). */
const visibleMeta = cache(async (id: string, viewerId: string | null) => {
  const meta = await db.post.findUnique({ where: { id }, select: { authorId: true, visibility: true, content: true, mediaUrls: true, mediaType: true, thumbnailUrl: true, author: { select: { name: true, bannedAt: true } } } });
  if (!meta || meta.author.bannedAt) return null;
  if (!viewerId) return meta.visibility === "PUBLIC" ? meta : null;
  if (await isBlockedEitherWay(viewerId, meta.authorId)) return null;
  if (meta.visibility === "CONNECTIONS" && viewerId !== meta.authorId && !(await isConnected(viewerId, meta.authorId))) return null;
  return meta;
});

export async function generateMetadata({ params }: PageProps<"/feed/[id]">): Promise<Metadata> {
  const { id } = await params;
  const [viewer, { t }] = await Promise.all([getViewer(), getI18n()]);
  const meta = await visibleMeta(id, viewer?.id ?? null);
  if (!meta) return { title: t("meta.post"), robots: { index: false } };
  const fallback = t("feed.publicPostBy", { name: meta.author.name });
  const title = postHeadline(meta.content, fallback);
  const description = meta.content.replace(/\s+/g, " ").trim().slice(0, 160) || fallback;
  const image = meta.mediaType === "VIDEO" ? meta.thumbnailUrl : meta.mediaUrls[0];
  return {
    title,
    description,
    alternates: { canonical: `/feed/${id}` },
    // Connections-only posts are never indexed, even when a connection opens them.
    robots: meta.visibility === "PUBLIC" ? undefined : { index: false, follow: false },
    openGraph: { type: "article", title, description, url: `/feed/${id}`, ...(image && { images: [image] }) },
  };
}

export default async function PostPage({ params }: PageProps<"/feed/[id]">) {
  const { id } = await params;
  const [viewer, { t }] = await Promise.all([getViewer(), getI18n()]);
  const meta = await visibleMeta(id, viewer?.id ?? null);
  if (!meta) notFound();
  const post = await getPost(viewer?.id ?? "", id);
  if (!post) notFound();
  return (
    <div className="mx-auto max-w-2xl">
      {post.visibility === "PUBLIC" && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(postJsonLd(post, APP_URL, t("feed.publicPostBy", { name: post.author.name }))) }} />
      )}
      {viewer ? (
        <>
          <Link href="/feed" className="mb-5 inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg">
            <ArrowLeft className="size-4" /> {t("feed.backToFeed")}
          </Link>
          <PostCard post={post} viewer={{ id: viewer.id, name: viewer.name, image: viewer.image }} />
        </>
      ) : (
        <PublicPost post={post} />
      )}
    </div>
  );
}
