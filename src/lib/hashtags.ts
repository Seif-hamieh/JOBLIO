// Hashtags in posts (#dubai, #developer, #مطور): letters in any language, digits and _, up to 50 of them. A # inside a
// word or a link ("page#top", "site.com/#about") is not a hashtag. The app uses the same rule; the database migration
// that filled in older posts uses the same one in SQL.
export const HASHTAG_RE = /(^|[^\p{L}\p{N}_&/])#([\p{L}\p{N}_]+)/gu;
export const MAX_HASHTAG = 50;
const MAX_TAGS = 30;

/** The post's hashtags, lowercase and without "#", each once, in the order they appear. */
export function extractHashtags(text: string): string[] {
  const tags = new Set<string>();
  for (const m of text.matchAll(HASHTAG_RE)) {
    const tag = m[2]!.toLowerCase();
    if (tag.length <= MAX_HASHTAG) tags.add(tag);
    if (tags.size >= MAX_TAGS) break;
  }
  return [...tags];
}

/** A search box entry as a hashtag ("#Dubai" or "dubai" → "dubai"), or null when it isn't a single tag. */
export function hashtagQuery(q: string): string | null {
  const tag = q.trim().replace(/^#/, "").toLowerCase();
  return /^[\p{L}\p{N}_]{1,50}$/u.test(tag) ? tag : null;
}
