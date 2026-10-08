// Countries and languages are stored as ISO codes; display names come from
// the platform's Intl data, so the list stays global without a lookup table.

const COUNTRY_CODES =
  "AD AE AF AG AL AM AO AR AT AU AZ BA BB BD BE BF BG BH BI BJ BN BO BR BS BT BW BY BZ CA CD CF CG CH CI CL CM CN CO CR CU CV CY CZ DE DJ DK DM DO DZ EC EE EG ER ES ET FI FJ FM FR GA GB GD GE GH GM GN GQ GR GT GW GY HK HN HR HT HU ID IE IL IN IQ IR IS IT JM JO JP KE KG KH KI KM KN KR KW KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MG MH MK ML MM MN MO MR MT MU MV MW MX MY MZ NA NE NG NI NL NO NP NR NZ OM PA PE PG PH PK PL PS PT PW PY QA RO RS RU RW SA SB SC SD SE SG SI SK SL SM SN SO SR SS ST SV SY SZ TD TG TH TJ TL TM TN TO TR TT TV TW TZ UA UG US UY UZ VA VC VE VN VU WS YE ZA ZM ZW".split(
    " ",
  );

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });
const languageNames = new Intl.DisplayNames(["en"], { type: "language" });

export const COUNTRIES = COUNTRY_CODES.map((code) => ({ code, name: regionNames.of(code) ?? code })).sort((a, b) =>
  a.name.localeCompare(b.name),
);

export function countryName(code: string | null | undefined) {
  if (!code) return "";
  try {
    return regionNames.of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

/** Resolves free text ("germany", "DE", "united arab emirates") to an ISO code. */
export function resolveCountryCode(input: string) {
  const v = input.trim().toLowerCase();
  if (!v) return null;
  if (v.length === 2) {
    const up = v.toUpperCase();
    if (COUNTRY_CODES.includes(up)) return up;
  }
  const aliases: Record<string, string> = { uk: "GB", usa: "US", uae: "AE", "united states of america": "US", england: "GB" };
  if (aliases[v]) return aliases[v];
  return COUNTRIES.find((c) => c.name.toLowerCase() === v)?.code ?? null;
}

export function formatLocation(city: string | null | undefined, countryCode: string | null | undefined) {
  return [city, countryName(countryCode)].filter(Boolean).join(", ");
}

export const LANGUAGE_CODES = [
  "en", "ar", "fr", "es", "de", "it", "pt", "nl", "sv", "no", "da", "fi", "pl", "cs", "ro", "hu", "el", "tr", "ru", "uk",
  "he", "fa", "ur", "hi", "bn", "ta", "te", "ml", "mr", "pa", "zh", "ja", "ko", "vi", "th", "id", "ms", "tl", "sw", "am",
  "ha", "yo", "zu",
];

export const LANGUAGES = LANGUAGE_CODES.map((code) => ({ code, name: languageNames.of(code) ?? code })).sort((a, b) =>
  a.name.localeCompare(b.name),
);

export function languageName(code: string) {
  try {
    return languageNames.of(code) ?? code;
  } catch {
    return code;
  }
}

/** Regional-indicator emoji flag for a country code. */
export function flag(code: string | null | undefined) {
  if (!code || code.length !== 2) return "";
  return String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}
