import { LOCALE_META, type Locale } from "@/i18n/config";

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 3600],
  ["month", 30 * 24 * 3600],
  ["week", 7 * 24 * 3600],
  ["day", 24 * 3600],
  ["hour", 3600],
  ["minute", 60],
];

const cache = new Map<Locale, ReturnType<typeof build>>();

/**
 * Country and language names as computed on the server. Browsers ship
 * different Intl data than Node (e.g. "Hong Kong" vs "Hong Kong SAR China"),
 * so the client uses the server's names to render identical text.
 */
export type DisplayNames = { regions: Record<string, string>; languages: Record<string, string> };
const serverNames = new Map<Locale, DisplayNames>();

/** Client only: adopt the server's display names for this locale (see I18nProvider). */
export function adoptDisplayNames(locale: Locale, names: DisplayNames | undefined) {
  if (!names || serverNames.has(locale)) return;
  serverNames.set(locale, names);
  cache.delete(locale);
}

function build(locale: Locale) {
  const tag = LOCALE_META[locale].intl;
  const rtf = new Intl.RelativeTimeFormat(tag, { numeric: "auto" });
  const rtfShort = new Intl.RelativeTimeFormat(tag, { numeric: "always", style: "narrow" });
  const num = new Intl.NumberFormat(tag);
  const compact = new Intl.NumberFormat(tag, { notation: "compact", maximumFractionDigits: 1 });
  const regions = new Intl.DisplayNames([tag], { type: "region" });
  const languages = new Intl.DisplayNames([tag], { type: "language" });
  const isAr = locale === "ar";
  const known = serverNames.get(locale);

  const country = (code: string | null | undefined) => {
    if (!code) return "";
    const upper = code.toUpperCase();
    if (known?.regions[upper]) return known.regions[upper]!;
    try {
      return regions.of(upper) ?? code;
    } catch {
      return code;
    }
  };

  return {
    locale,
    number: (n: number) => num.format(n),
    compact: (n: number) => compact.format(n),
    money: (minor: number, currency = "usd") => new Intl.NumberFormat(tag, { style: "currency", currency: currency.toUpperCase() }).format(minor / 100),
    salary(min: number | null | undefined, max: number | null | undefined, currency = "USD", period: "HOUR" | "MONTH" | "YEAR" = "YEAR") {
      if (min == null && max == null) return null;
      const fmt = new Intl.NumberFormat(tag, {
        style: "currency",
        currency,
        notation: period === "HOUR" ? "standard" : "compact",
        maximumFractionDigits: period === "HOUR" ? 0 : 1,
      });
      const suffix = isAr ? (period === "HOUR" ? "/ساعة" : period === "MONTH" ? "/شهر" : "/سنة") : period === "HOUR" ? "/hr" : period === "MONTH" ? "/mo" : "/yr";
      if (min != null && max != null && min !== max) return `${fmt.format(min)} – ${fmt.format(max)}${suffix}`;
      return `${fmt.format((min ?? max)!)}${suffix}`;
    },
    timeAgo(date: Date | string, now = Date.now()) {
      const seconds = Math.round((new Date(date).getTime() - now) / 1000);
      const abs = Math.abs(seconds);
      if (abs < 45) return isAr ? "الآن" : "just now";
      for (const [unit, size] of UNITS) if (abs >= size) return rtf.format(Math.round(seconds / size), unit);
      return rtf.format(Math.round(seconds / 60), "minute");
    },
    shortTimeAgo(date: Date | string, now = Date.now()) {
      const d = new Date(date);
      const s = Math.max(0, Math.round((now - d.getTime()) / 1000));
      if (s < 60) return isAr ? "الآن" : "now";
      if (!isAr) {
        if (s < 3600) return `${Math.floor(s / 60)}m`;
        if (s < 86400) return `${Math.floor(s / 3600)}h`;
        if (s < 7 * 86400) return `${Math.floor(s / 86400)}d`;
      } else {
        if (s < 3600) return rtfShort.format(-Math.floor(s / 60), "minute");
        if (s < 86400) return rtfShort.format(-Math.floor(s / 3600), "hour");
        if (s < 7 * 86400) return rtfShort.format(-Math.floor(s / 86400), "day");
      }
      return d.toLocaleDateString(tag, { month: "short", day: "numeric", timeZone: "UTC" });
    },
    // Calendar dates (experience months, issue dates…) are stored as UTC
    // midnights and formatted in UTC, so the server and every browser agree.
    // Times of day go through <LocalTime>, which uses the viewer's zone.
    date(date: Date | string | null | undefined, opts: Intl.DateTimeFormatOptions = { month: "short", year: "numeric" }) {
      return date ? new Date(date).toLocaleDateString(tag, { timeZone: "UTC", ...opts }) : "";
    },
    duration(start: Date | string, end?: Date | string | null) {
      const s = new Date(start);
      const e = end ? new Date(end) : new Date();
      const months = Math.max(1, (e.getUTCFullYear() - s.getUTCFullYear()) * 12 + (e.getUTCMonth() - s.getUTCMonth()) + 1);
      const y = Math.floor(months / 12);
      const m = months % 12;
      if (isAr) return [y ? `${y} ${y === 1 ? "سنة" : y === 2 ? "سنتان" : y <= 10 ? "سنوات" : "سنة"}` : "", m ? `${m} ${m === 1 ? "شهر" : m === 2 ? "شهران" : m <= 10 ? "أشهر" : "شهرًا"}` : ""].filter(Boolean).join(" و");
      return [y ? `${y} yr${y > 1 ? "s" : ""}` : "", m ? `${m} mo${m > 1 ? "s" : ""}` : ""].filter(Boolean).join(" ");
    },
    years(n: number) {
      const r = Math.round(n * 10) / 10;
      return isAr ? `${num.format(r)} ${r >= 3 && r <= 10 ? "سنوات" : "سنة"}` : `${r} yr${r === 1 ? "" : "s"}`;
    },
    country,
    location: (city: string | null | undefined, code: string | null | undefined) => [city, country(code)].filter(Boolean).join(isAr ? "، " : ", "),
    language(code: string) {
      if (known?.languages[code]) return known.languages[code]!;
      try {
        return languages.of(code) ?? code;
      } catch {
        return code;
      }
    },
    list: (items: string[]) => new Intl.ListFormat(tag, { style: "short", type: "conjunction" }).format(items),
  };
}

export function makeFormat(locale: Locale) {
  let f = cache.get(locale);
  if (!f) {
    f = build(locale);
    cache.set(locale, f);
  }
  return f;
}

export type Format = ReturnType<typeof makeFormat>;
