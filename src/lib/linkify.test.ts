import { describe, expect, it } from "vitest";
import { hrefFor, URL_RE } from "./linkify";

describe("linkify", () => {
  it("finds http(s) and www. links, without trailing punctuation", () => {
    const parts = "See https://example.com/a, and www.google.com. Done".split(URL_RE);
    expect(parts.filter((_, i) => i % 2 === 1)).toEqual(["https://example.com/a", "www.google.com"]);
  });

  it("opens bare www. links over https", () => {
    expect(hrefFor("https://example.com/a")).toBe("https://example.com/a");
    expect(hrefFor("www.google.com")).toBe("https://www.google.com");
  });
});
