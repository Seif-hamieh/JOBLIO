import "server-only";
import { revalidateTag } from "next/cache";

export const SITEMAP_TAG = "sitemap";

/** Call after a change that adds or removes a public URL (job published/closed, company edited). */
export function refreshSitemap() {
  try {
    revalidateTag(SITEMAP_TAG, { expire: 0 });
  } catch {
    // Outside a request (scripts, tests) there is no cache to refresh.
  }
}
