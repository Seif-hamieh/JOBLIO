import { describe, expect, it } from "vitest";
import { postHeadline, postJsonLd } from "./post-ld";

const post = {
  id: "p1",
  content: "We're hiring a designer in Beirut!\nDM me for details.",
  createdAt: new Date("2026-10-01T10:00:00Z"),
  updatedAt: new Date("2026-10-02T10:00:00Z"),
  mediaUrls: ["/api/v1/files/public/media/u1/v.mp4"],
  mediaType: "VIDEO" as const,
  thumbnailUrl: "/api/v1/files/public/media/u1/t.jpg",
  likeCount: 3,
  commentCount: 1,
  shareCount: 0,
  // Extra fields a database row could carry: none of them may reach the page's structured data.
  author: { name: "Sara K", username: "sara", email: "sara@example.com", id: "u1", headline: "Designer" },
  company: null,
  job: null,
};

describe("postJsonLd", () => {
  it("describes the post with only what the page shows", () => {
    const ld = postJsonLd(post, "https://www.getjoblio.app", "Post by Sara K");
    expect(ld).toMatchObject({
      "@type": "DiscussionForumPosting",
      url: "https://www.getjoblio.app/feed/p1",
      headline: "We're hiring a designer in Beirut!",
      author: { "@type": "Person", name: "Sara K", url: "https://www.getjoblio.app/in/sara" },
      video: { "@type": "VideoObject", contentUrl: "https://www.getjoblio.app/api/v1/files/public/media/u1/v.mp4", thumbnailUrl: "https://www.getjoblio.app/api/v1/files/public/media/u1/t.jpg" },
    });
    expect(Object.keys(ld.author)).toEqual(["@type", "name", "url"]);
  });

  it("never contains an email address or an internal id", () => {
    const json = JSON.stringify(postJsonLd(post, "https://www.getjoblio.app", "Post"));
    expect(json).not.toContain("@example.com");
    expect(json).not.toContain("email");
    expect(json).not.toContain('"u1"');
  });

  it("links a shared job instead of repeating its JobPosting", () => {
    const ld = postJsonLd({ ...post, mediaType: "IMAGE", mediaUrls: [], job: { id: "j1", title: "Designer" } }, "https://x.test", "Post");
    expect(ld.about).toEqual({ "@type": "JobPosting", name: "Designer", url: "https://x.test/jobs/j1" });
  });

  it("cuts long headlines at a word", () => {
    expect(postHeadline("word ".repeat(40), "x").length).toBeLessThanOrEqual(111);
    expect(postHeadline("   ", "Post by Sara")).toBe("Post by Sara");
  });
});
