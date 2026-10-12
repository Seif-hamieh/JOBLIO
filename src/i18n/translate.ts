import { en, type Dictionary } from "@/i18n/dictionaries/en";
import { ar } from "@/i18n/dictionaries/ar";
import { LOCALE_META, type Locale } from "@/i18n/config";

export const DICTIONARIES: Record<Locale, Dictionary> = { en, ar };

// Dot-separated paths to every string leaf, e.g. "nav.home".
type Leaves<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];
export type TKey = Leaves<Dictionary>;
export type TVars = Record<string, string | number>;

function lookup(dict: unknown, key: string): string | undefined {
  let cur: unknown = dict;
  for (const part of key.split(".")) {
    if (cur && typeof cur === "object" && part in cur) cur = (cur as Record<string, unknown>)[part];
    else return undefined;
  }
  return typeof cur === "string" ? cur : undefined;
}

/**
 * `t("jobs.count", { n: 3 })`. Supports `{var}` placeholders and simple
 * plurals: `"{n} job|{n} jobs"` (Arabic dictionaries may list
 * zero|one|two|few|many|other forms). Falls back to English, then the key.
 */
export function createT(locale: Locale) {
  const dict = DICTIONARIES[locale];
  const plural = new Intl.PluralRules(LOCALE_META[locale].intl);
  const ORDER = ["zero", "one", "two", "few", "many", "other"] as const;

  function t(key: TKey | (string & {}), vars?: TVars): string {
    let s = lookup(dict, key) ?? lookup(en, key) ?? key;
    // `n` may arrive already formatted ("1,234", "1.2K"); the plural form is chosen from its numeric value.
    const count = vars ? (typeof vars.n === "number" ? vars.n : typeof vars.n === "string" ? parseCount(vars.n) : null) : null;
    if (s.includes("|") && count != null) {
      const forms = s.split("|");
      if (forms.length === 2) s = count === 1 ? forms[0]! : forms[1]!;
      else {
        const cat = count === 0 ? "zero" : plural.select(count);
        s = forms[ORDER.indexOf(cat as (typeof ORDER)[number])] ?? forms[forms.length - 1]!;
      }
    }
    return vars ? s.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`)) : s;
  }
  return t;
}

/** Numeric value of an already-formatted count ("1,234", "١٢", "1.2K"), or null if it isn't one. */
export function parseCount(s: string): number | null {
  const latin = s.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x6f0));
  if (!/\d/.test(latin)) return null;
  // Compact notation ("1K", "2 ألف") is always a large number, whatever the leading digit.
  if (/[KMB]|ألف|آلاف|مليون|مليار/i.test(latin)) return 1000;
  const n = Number(latin.replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : null;
}

export type T = ReturnType<typeof createT>;

function storedName(t: T, ns: string, name: string) {
  const key = `${ns}.${name}`;
  const out = t(key);
  return out === key ? name : out;
}

/** Industry names are stored in English; show the translation when one exists. */
export const industryName = (t: T, name: string) => storedName(t, "industries", name);
/** Skill categories are stored in English too. */
export const categoryName = (t: T, name: string) => storedName(t, "skillCategories", name);
