import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { en } from "./dictionaries/en";
import { ar } from "./dictionaries/ar";

// Every literal translation key in the source must exist in both dictionaries,
// so a missing string can never reach a user as a raw key like "msg.photoAdded".

const SRC = join(__dirname, "..");

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (name === "generated" || name === "dictionaries") return [];
    if (statSync(p).isDirectory()) return files(p);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [p] : [];
  });
}

function has(dict: unknown, key: string) {
  let cur: unknown = dict;
  for (const part of key.split(".")) {
    if (cur && typeof cur === "object" && part in cur) cur = (cur as Record<string, unknown>)[part];
    else return false;
  }
  return typeof cur === "string";
}

const keys = new Map<string, string>();
for (const file of files(SRC)) {
  const src = readFileSync(file, "utf8");
  // t("ns.key") / t('ns.key') — literal keys only (template keys are checked elsewhere).
  for (const m of src.matchAll(/\bt\(\s*["']([a-zA-Z][\w]*\.[\w.]+)["']/g)) keys.set(m[1]!, file);
  // Encoded server messages: "@msg.key" or "@msg.key?{...}".
  for (const m of src.matchAll(/["'`]@([a-zA-Z]\w*\.[\w.]+?)(?:\?|["'`])/g)) keys.set(m[1]!, file);
}

describe("translation keys used in code", () => {
  it("finds keys to check", () => {
    expect(keys.size).toBeGreaterThan(200);
  });
  it("exist in English and Arabic", () => {
    const missing = [...keys]
      .filter(([k]) => !k.split(".").includes("X")) // placeholder examples in doc comments
      .filter(([k]) => !has(en, k) || !has(ar, k))
      .map(([k, f]) => `${k}  (${f.slice(SRC.length + 1)})`);
    expect(missing).toEqual([]);
  });
});
