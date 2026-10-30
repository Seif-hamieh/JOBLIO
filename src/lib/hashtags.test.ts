import { describe, expect, it } from "vitest";
import { extractHashtags, hashtagQuery } from "./hashtags";

describe("extractHashtags", () => {
  it("finds tags in any language, lowercase and once each", () => {
    expect(extractHashtags("Hiring in #Dubai! #developer, #remote #dubai")).toEqual(["dubai", "developer", "remote"]);
    expect(extractHashtags("وظيفة #مطور في #بيروت")).toEqual(["مطور", "بيروت"]);
    expect(extractHashtags("#start of line\n#next_line")).toEqual(["start", "next_line"]);
  });
  it("skips # inside words, links and HTML entities", () => {
    expect(extractHashtags("C# and page#top and https://site.com/#about and &#39;")).toEqual([]);
  });
  it("skips tags over 50 characters", () => {
    expect(extractHashtags(`#${"a".repeat(51)} #ok`)).toEqual(["ok"]);
  });
});

describe("hashtagQuery", () => {
  it("reads one word with or without #", () => {
    expect(hashtagQuery("#Dubai")).toBe("dubai");
    expect(hashtagQuery(" remote ")).toBe("remote");
    expect(hashtagQuery("react developer")).toBeNull();
    expect(hashtagQuery("#")).toBeNull();
  });
});
