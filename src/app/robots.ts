import type { MetadataRoute } from "next";
import { APP_URL } from "@/lib/utils";
import { BLOCKED_BOTS } from "@/lib/bots";

// Public pages are crawlable; signed-in areas, APIs and search results are not.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/home",
          // The feed itself ("$": that URL only); single public posts (/feed/<id>) stay crawlable.
          "/feed$",
          "/feed/new",
          "/feed/drafts",
          "/network",
          "/messages",
          "/notifications",
          "/profile",
          "/applications",
          "/interviews",
          "/settings",
          "/recruiter",
          "/company/",
          "/onboarding",
          "/search",
          "/dev-mailbox",
          "/jobs/for-you",
          "/jobs/saved",
        ],
      },
      // AI-training and SEO scrapers: no visitors in return for the server time they cost (also refused in src/proxy.ts).
      { userAgent: [...BLOCKED_BOTS], disallow: "/" },
    ],
    sitemap: `${APP_URL}/sitemap.xml`,
    host: APP_URL,
  };
}
