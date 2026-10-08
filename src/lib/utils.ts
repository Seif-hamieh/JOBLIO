import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

export function absoluteUrl(path: string) {
  return `${APP_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export function slugify(input: string) {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]![0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]![0] ?? "") : "";
  return (first + last).toUpperCase();
}

/** Deterministic 32-bit hash — used for avatar gradients and similar cosmetics. */
export function hashString(input: string) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${formatNumber(count)} ${count === 1 ? singular : plural}`;
}

const compactFormatter = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
const numberFormatter = new Intl.NumberFormat("en");

export function formatNumber(n: number) {
  return numberFormatter.format(n);
}

export function formatCompact(n: number) {
  return compactFormatter.format(n);
}

export function formatMoney(amountMinor: number, currency = "usd") {
  return new Intl.NumberFormat("en", { style: "currency", currency: currency.toUpperCase() }).format(amountMinor / 100);
}

export function formatSalary(
  min: number | null | undefined,
  max: number | null | undefined,
  currency = "USD",
  period: "HOUR" | "MONTH" | "YEAR" = "YEAR",
) {
  if (min == null && max == null) return null;
  const fmt = new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    notation: period === "HOUR" ? "standard" : "compact",
    maximumFractionDigits: period === "HOUR" ? 0 : 1,
  });
  const suffix = period === "HOUR" ? "/hr" : period === "MONTH" ? "/mo" : "/yr";
  if (min != null && max != null && min !== max) return `${fmt.format(min)} – ${fmt.format(max)}${suffix}`;
  return `${fmt.format((min ?? max)!)}${suffix}`;
}

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 3600],
  ["month", 30 * 24 * 3600],
  ["week", 7 * 24 * 3600],
  ["day", 24 * 3600],
  ["hour", 3600],
  ["minute", 60],
];

export function timeAgo(date: Date | string, now = Date.now()) {
  const seconds = Math.round((new Date(date).getTime() - now) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 45) return "just now";
  for (const [unit, size] of UNITS) {
    if (abs >= size) return rtf.format(Math.round(seconds / size), unit);
  }
  return rtf.format(Math.round(seconds / 60), "minute");
}

/** Short relative label for dense lists: "5m", "3h", "2d", "Mar 4". */
export function shortTimeAgo(date: Date | string, now = Date.now()) {
  const d = new Date(date);
  const s = Math.max(0, Math.round((now - d.getTime()) / 1000));
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}d`;
  return d.toLocaleDateString("en", { month: "short", day: "numeric" });
}

export function formatDate(date: Date | string | null | undefined, opts: Intl.DateTimeFormatOptions = { month: "short", year: "numeric" }) {
  if (!date) return "";
  return new Date(date).toLocaleDateString("en", opts);
}

export function formatDateTime(date: Date | string) {
  return new Date(date).toLocaleString("en", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** "2 yrs 3 mos" between two dates (end defaults to now). */
export function formatDuration(start: Date | string, end?: Date | string | null) {
  const s = new Date(start);
  const e = end ? new Date(end) : new Date();
  let months = (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth()) + 1;
  months = Math.max(1, months);
  const years = Math.floor(months / 12);
  const rem = months % 12;
  const parts = [];
  if (years) parts.push(`${years} yr${years > 1 ? "s" : ""}`);
  if (rem) parts.push(`${rem} mo${rem > 1 ? "s" : ""}`);
  return parts.join(" ");
}

export function truncate(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

export function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

/** Safe for user-provided URLs rendered as links: only http(s). */
export function safeExternalUrl(url: string | null | undefined) {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

export function hostname(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
