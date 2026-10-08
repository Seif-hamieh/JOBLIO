import { COUNTRIES } from "@/lib/geo";
import type { Format } from "@/i18n/format";

const cache = new Map<string, { code: string; name: string }[]>();

/** Country options with names in the active language, sorted for that language. */
export function localizedCountries(f: Format) {
  let list = cache.get(f.locale);
  if (!list) {
    list = COUNTRIES.map((c) => ({ code: c.code, name: f.country(c.code) })).sort((a, b) => a.name.localeCompare(b.name, f.locale));
    cache.set(f.locale, list);
  }
  return list;
}
