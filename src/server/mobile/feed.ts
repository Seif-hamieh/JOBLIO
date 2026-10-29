import "server-only";
import type { FeedComment, FeedPost } from "@/server/services/feed";

// What the mobile API returns for feed posts and comments (explicit fields, as in dto.ts). Media are site paths
// (e.g. /api/v1/files/public/post/…): the app puts https://www.getjoblio.app in front.

const iso = (d: Date) => d.toISOString();

export function toPost(p: FeedPost, viewerId: string) {
  return {
    id: p.id,
    type: p.type,
    visibility: p.visibility,
    content: p.content,
    media: p.mediaUrls,
    // VIDEO: media holds the one video (played by streaming it) and thumbnail its still frame.
    mediaType: p.mediaType,
    thumbnail: p.thumbnailUrl,
    createdAt: iso(p.createdAt),
    likeCount: p.likeCount,
    commentCount: p.commentCount,
    shareCount: p.shareCount,
    liked: p.liked,
    mine: p.authorId === viewerId,
    author: { id: p.author.id, name: p.author.name, image: p.author.image, username: p.author.username, headline: p.author.profile?.headline ?? null },
    // Posted on behalf of a company page.
    company: p.company ? { name: p.company.name, slug: p.company.slug, logoUrl: p.company.logoUrl, brandColor: p.company.brandColor } : null,
    job: p.job ? { id: p.job.id, title: p.job.title, workMode: p.job.workMode, city: p.job.city, open: p.job.status === "OPEN", company: p.job.company.name } : null,
    project: p.project ? { title: p.project.title, summary: p.project.summary, imageUrl: p.project.imageUrl, url: p.project.url } : null,
    shared: p.sharedPost
      ? { id: p.sharedPost.id, content: p.sharedPost.content, media: p.sharedPost.mediaUrls, mediaType: p.sharedPost.mediaType, thumbnail: p.sharedPost.thumbnailUrl, createdAt: iso(p.sharedPost.createdAt), author: p.sharedPost.author.name, company: p.sharedPost.company?.name ?? null }
      : null,
  };
}

export function toComment(c: FeedComment, viewerId: string) {
  return {
    id: c.id,
    content: c.content,
    createdAt: iso(c.createdAt),
    mine: c.author.id === viewerId,
    author: { id: c.author.id, name: c.author.name, image: c.author.image, username: c.author.username, headline: c.author.profile?.headline ?? null },
  };
}
