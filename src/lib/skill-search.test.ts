import { describe, expect, it } from "vitest";
import { skillRows } from "./reference-data";
import { normalizeSkill, searchSkills, SKILL_ALIASES_EN, type SearchableSkill } from "./skill-search";

const skills: SearchableSkill[] = skillRows().map((r, i) => ({ ...r, id: `s${i}`, usageCount: r.name === "JavaScript" ? 50 : 0 }));
const names = (q: string) => searchSkills(skills, q).map((s) => s.name);

describe("skill search", () => {
  it("puts the exact match first even when a longer skill is more popular", () => {
    expect(names("java")[0]).toBe("Java");
    expect(names("java")).toContain("JavaScript");
    expect(names("Java")[0]).toBe("Java");
  });

  it("ignores case, dots and spaces", () => {
    expect(names("nodejs")[0]).toBe("Node.js");
    expect(names("node js")[0]).toBe("Node.js");
    expect(names("NEXT.JS")[0]).toBe("Next.js");
  });

  it("understands common abbreviations", () => {
    expect(names("js")[0]).toBe("JavaScript");
    expect(names("k8s")[0]).toBe("Kubernetes");
    expect(names("c#")[0]).toBe("C#");
    expect(names("c++")[0]).toBe("C++");
  });

  it("matches Arabic names partially and across letter forms", () => {
    expect(names("التسويق")).toContain("Email Marketing");
    expect(names("تسويق المحتوى")[0]).toBe("Content Marketing");
    expect(names("اداره المشاريع")[0]).toBe("Project Management"); // typed without hamza / with haa
  });

  it("collapses duplicates that differ only in case or punctuation", () => {
    const dupes = [...skills, { id: "dup", name: "javascript", slug: "javascript-2", category: "Engineering", aliases: [], usageCount: 0 }];
    expect(searchSkills(dupes, "javascript").filter((s) => normalizeSkill(s.name) === "javascript")).toHaveLength(1);
  });

  it("returns the most used skills for an empty query", () => {
    expect(searchSkills(skills, "", 3)[0]!.name).toBe("JavaScript");
  });

  it("only aliases skills that exist", () => {
    const all = new Set(skills.map((s) => s.name));
    expect(Object.keys(SKILL_ALIASES_EN).filter((n) => !all.has(n))).toEqual([]);
  });
});
