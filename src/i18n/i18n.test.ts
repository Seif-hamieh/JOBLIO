import { describe, expect, it } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { ar } from "@/i18n/dictionaries/ar";
import { createT } from "@/i18n/translate";
import { decodeMessage, k, resolveMessage } from "@/i18n/message";

function leaves(obj: unknown, prefix = ""): [string, string][] {
  if (typeof obj === "string") return [[prefix, obj]];
  return Object.entries(obj as Record<string, unknown>).flatMap(([key, v]) => leaves(v, prefix ? `${prefix}.${key}` : key));
}

// The set of variable names a string uses (plural forms may repeat or omit {n}).
const placeholders = (s: string) => [...new Set([...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))].sort().join();

describe("dictionaries", () => {
  const enLeaves = new Map(leaves(en));
  const arLeaves = new Map(leaves(ar));

  it("Arabic covers every English key", () => {
    const missing = [...enLeaves.keys()].filter((key) => !arLeaves.has(key));
    expect(missing).toEqual([]);
  });

  it("uses the same placeholders in both languages", () => {
    const mismatched = [...enLeaves].filter(([key, s]) => {
      const other = arLeaves.get(key);
      return other !== undefined && placeholders(s) !== placeholders(other);
    });
    expect(mismatched.map(([key]) => key)).toEqual([]);
  });
});

describe("translate", () => {
  it("picks English plural forms", () => {
    const t = createT("en");
    expect(t("jobs.count", { n: 1 })).toBe("1 job");
    expect(t("jobs.count", { n: 4 })).toBe("4 jobs");
  });

  it("translates to Arabic and keeps Latin digits", () => {
    const t = createT("ar");
    expect(t("match.pct", { n: 92 })).toContain("92");
    expect(t("nav.home")).not.toBe("Home");
  });

  it("falls back to English, then to the key", () => {
    const t = createT("ar");
    expect(t("does.not.exist")).toBe("does.not.exist");
  });
});

describe("encoded messages", () => {
  it("round-trips keys and variables", () => {
    const s = k("msg.tooOften", { s: 12 });
    expect(decodeMessage(s)).toEqual({ key: "msg.tooOften", vars: { s: 12 } });
    expect(resolveMessage(createT("en"), s)).toBe("You're doing that too often. Try again in 12s.");
  });

  it("translates nested key variables", () => {
    const s = k("notif.achievement", { title: "@achievementsDef.TOP_SKILL.title" });
    expect(resolveMessage(createT("en"), s)).toBe("Achievement unlocked: Top Skill");
  });

  it("leaves plain text and unknown keys untouched", () => {
    const t = createT("en");
    expect(resolveMessage(t, "Hello")).toBe("Hello");
    expect(resolveMessage(t, "@someone")).toBe("@someone");
  });
});
