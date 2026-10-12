import type { MetadataRoute } from "next";
import { APP_URL } from "@/lib/utils";

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
          "/feed",
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
    ],
    sitemap: `${APP_URL}/sitemap.xml`,
    host: APP_URL,
  };
}
