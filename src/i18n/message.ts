import type { T, TKey, TVars } from "@/i18n/translate";

/**
 * Server code (services, schemas, actions) doesn't know the reader's language,
 * so user-facing messages travel as encoded keys — `"@msg.saved"` or
 * `"@msg.tooOften?{"s":3}"` — and are translated at the edge (withViewer,
 * notification rendering). Plain strings pass through untouched.
 */
export function k(key: TKey, vars?: TVars): string {
  return vars ? `@${key}?${JSON.stringify(vars)}` : `@${key}`;
}

export function decodeMessage(s: string): { key: string; vars?: TVars } | null {
  if (!s.startsWith("@")) return null;
  const q = s.indexOf("?");
  if (q === -1) return { key: s.slice(1) };
  try {
    return { key: s.slice(1, q), vars: JSON.parse(s.slice(q + 1)) as TVars };
  } catch {
    return { key: s.slice(1, q) };
  }
}

/** Translates a key; variables that are themselves encoded keys (`"@achievementsDef.X.title"`) are translated too. */
export function translateKey(t: T, key: string, vars?: TVars | null): string {
  if (!vars) return t(key);
  const resolved: TVars = {};
  for (const [name, v] of Object.entries(vars)) resolved[name] = typeof v === "string" && v.startsWith("@") ? resolveMessage(t, v) : v;
  return t(key, resolved);
}

export function resolveMessage(t: T, s: string): string {
  const m = decodeMessage(s);
  if (!m) return s;
  const out = translateKey(t, m.key, m.vars);
  // Unknown key (e.g. user text that merely starts with "@"): show it verbatim.
  return out === m.key ? s : out;
}
