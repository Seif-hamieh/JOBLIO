import { describe, expect, it } from "vitest";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import { INDUSTRIES, SKILL_ALIASES_AR, SKILLS, industryRows, referenceSlug, skillRows } from "./reference-data";

describe("reference data", () => {
  it("has enough skills and industries for a fresh database", () => {
    expect(skillRows().length).toBeGreaterThanOrEqual(100);
    expect(industryRows().length).toBeGreaterThanOrEqual(30);
  });

  it("has unique names and slugs (both are unique columns)", () => {
    for (const rows of [skillRows(), industryRows()]) {
      expect(new Set(rows.map((r) => r.name)).size).toBe(rows.length);
      expect(new Set(rows.map((r) => r.slug)).size).toBe(rows.length);
      expect(rows.every((r) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(r.slug))).toBe(true);
    }
  });

  it("translates every industry and skill category into English and Arabic", () => {
    for (const name of INDUSTRIES) {
      expect(en.industries, name).toHaveProperty([name]);
      expect(ar.industries, name).toHaveProperty([name]);
    }
    for (const category of Object.keys(SKILLS)) {
      expect(en.skillCategories, category).toHaveProperty([category]);
      expect(ar.skillCategories, category).toHaveProperty([category]);
    }
  });

  it("only aliases skills that exist", () => {
    const names = new Set(Object.values(SKILLS).flat());
    expect(Object.keys(SKILL_ALIASES_AR).filter((n) => !names.has(n))).toEqual([]);
  });

  it("keeps the slugs the seed always produced", () => {
    expect(referenceSlug("C++")).toBe("cpp");
    expect(referenceSlug("C#")).toBe("csharp");
    expect(referenceSlug(".NET")).toBe("dotnet");
    expect(referenceSlug("Next.js")).toBe("next-js");
    expect(referenceSlug("E-commerce & Retail")).toBe("e-commerce-retail");
  });
});
