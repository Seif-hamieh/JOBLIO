import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/server/db", () => ({ db: {} }));

const { resumeHtml, resumePdfLink, resumeSchema, verifyResumePdfLink } = await import("./resume-builder");

const base = { fullName: "Sam", experience: [], education: [], skills: [], languages: [], links: [] };

describe("resumeHtml", () => {
  it("shows what members typed as text, never as HTML, and drops unsafe links", () => {
    const html = resumeHtml(resumeSchema.parse({ ...base, headline: "<img src=x onerror=alert(1)>", links: [{ label: "x", url: "javascript:alert(1)" }] }), "en");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
    expect(html).not.toContain('href="javascript');
  });

  it("is right-to-left in Arabic", () => {
    expect(resumeHtml(resumeSchema.parse(base), "ar")).toContain('dir="rtl"');
  });
});

describe("resume PDF links", () => {
  it("accepts its own link and rejects a changed one", () => {
    const url = new URL(resumePdfLink("https://x.test", "user1", "en"));
    const exp = url.searchParams.get("exp");
    const sig = url.searchParams.get("sig");
    expect(verifyResumePdfLink("user1", "en", exp, sig)).toBe(true);
    expect(verifyResumePdfLink("user2", "en", exp, sig)).toBe(false);
    expect(verifyResumePdfLink("user1", "ar", exp, sig)).toBe(false);
    expect(verifyResumePdfLink("user1", "en", String(Number(exp) + 60), sig)).toBe(false);
  });
});
