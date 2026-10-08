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
    if (s.includes("|") && vars && typeof vars.n === "number") {
      const forms = s.split("|");
      if (forms.length === 2) s = vars.n === 1 ? forms[0]! : forms[1]!;
      else {
        const cat = vars.n === 0 ? "zero" : plural.select(vars.n);
        s = forms[ORDER.indexOf(cat as (typeof ORDER)[number])] ?? forms[forms.length - 1]!;
      }
    }
    return vars ? s.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`)) : s;
  }
  return t;
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
