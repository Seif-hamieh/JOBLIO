// schema.org DiscussionForumPosting for a public feed post (Google's "Discussion forum" structured data). Built only
// from what the post page shows. A post that shares a job links to the job page, which carries the JobPosting:
// Google wants each job marked up once, on its own page.

type PostForLd = {
  id: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  mediaUrls: string[];
  mediaType: "IMAGE" | "VIDEO";
  thumbnailUrl: string | null;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  author: { name: string; username: string | null };
  company: { name: string; slug: string } | null;
  job: { id: string; title: string } | null;
};

/** The first line of the post, cut at a word near 110 characters (Google shows headlines that short). */
export function postHeadline(content: string, fallback: string) {
  const line = content.trim().split("\n")[0]!.trim();
  if (!line) return fallback;
  if (line.length <= 110) return line;
  const cut = line.slice(0, 110);
  return `${cut.slice(0, cut.lastIndexOf(" ") > 60 ? cut.lastIndexOf(" ") : 110)}…`;
}

export function postJsonLd(post: PostForLd, siteUrl: string, fallbackHeadline: string) {
  const abs = (u: string) => (u.startsWith("http") ? u : `${siteUrl}${u}`);
  const url = `${siteUrl}/feed/${post.id}`;
  const author = post.company
    ? { "@type": "Organization", name: post.company.name, url: `${siteUrl}/companies/${post.company.slug}` }
    : { "@type": "Person", name: post.author.name, ...(post.author.username && { url: `${siteUrl}/in/${post.author.username}` }) };
  const video = post.mediaType === "VIDEO" && post.mediaUrls[0];
  const headline = postHeadline(post.content, fallbackHeadline);

  return {
    "@context": "https://schema.org",
    "@type": "DiscussionForumPosting",
    "@id": url,
    url,
    mainEntityOfPage: url,
    headline,
    text: post.content,
    datePublished: post.createdAt.toISOString(),
    dateModified: post.updatedAt.toISOString(),
    author,
    ...(!video && post.mediaUrls.length > 0 && { image: post.mediaUrls.map(abs) }),
    ...(video && {
      video: {
        "@type": "VideoObject",
        name: headline,
        description: post.content.slice(0, 300) || headline,
        contentUrl: abs(video),
        uploadDate: post.createdAt.toISOString(),
        ...(post.thumbnailUrl && { thumbnailUrl: abs(post.thumbnailUrl) }),
      },
    }),
    ...(post.job && { about: { "@type": "JobPosting", name: post.job.title, url: `${siteUrl}/jobs/${post.job.id}` } }),
    interactionStatistic: [
      { "@type": "InteractionCounter", interactionType: "https://schema.org/LikeAction", userInteractionCount: post.likeCount },
      { "@type": "InteractionCounter", interactionType: "https://schema.org/CommentAction", userInteractionCount: post.commentCount },
      { "@type": "InteractionCounter", interactionType: "https://schema.org/ShareAction", userInteractionCount: post.shareCount },
    ],
  };
}
