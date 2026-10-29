import { describe, expect, it } from "vitest";
import { parseArticle, parseInline } from "./article-text";

describe("parseArticle", () => {
  it("splits paragraphs, headings, lists and quotes", () => {
    const blocks = parseArticle("## Intro\nFirst line\nsecond line\n\n- one\n- two\n\n> wise words\n\nEnd");
    expect(blocks.map((b) => b.kind)).toEqual(["h2", "p", "list", "quote", "p"]);
    expect(blocks[2]).toEqual({ kind: "list", items: [[{ kind: "text", text: "one" }], [{ kind: "text", text: "two" }]] });
  });

  it("reads bold, italic and only http(s) links", () => {
    expect(parseInline("a **b** *c* [d](https://x.y) [e](javascript:alert(1))")).toEqual([
      { kind: "text", text: "a " },
      { kind: "bold", text: "b" },
      { kind: "text", text: " " },
      { kind: "italic", text: "c" },
      { kind: "text", text: " " },
      { kind: "link", text: "d", href: "https://x.y" },
      { kind: "text", text: " [e](javascript:alert(1))" },
    ]);
  });
});
