import { describe, expect, it } from "vitest";
import { parseVideoUrl } from "./video";

describe("parseVideoUrl", () => {
  it.each([
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://youtu.be/dQw4w9WgXcQ?t=10",
    "https://m.youtube.com/watch?v=dQw4w9WgXcQ&feature=share",
    "https://www.youtube.com/shorts/dQw4w9WgXcQ",
    "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
  ])("reads YouTube link %s", (link) => {
    const v = parseVideoUrl(link);
    expect(v?.provider).toBe("youtube");
    expect(v?.url).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(v?.embedUrl).toMatch(/^https:\/\/www\.youtube-nocookie\.com\/embed\/dQw4w9WgXcQ/);
  });

  it.each(["https://vimeo.com/76979871", "https://player.vimeo.com/video/76979871", "https://vimeo.com/channels/staffpicks/76979871"])("reads Vimeo link %s", (link) => {
    const v = parseVideoUrl(link);
    expect(v?.provider).toBe("vimeo");
    expect(v?.url).toBe("https://vimeo.com/76979871");
  });

  it.each(["", "not a url", "javascript:alert(1)", "https://evil.example/watch?v=dQw4w9WgXcQ", "https://www.youtube.com/watch?v=short", "https://vimeo.com/about"])("rejects %s", (link) => {
    expect(parseVideoUrl(link)).toBeNull();
  });
});
