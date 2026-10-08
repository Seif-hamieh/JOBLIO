"use client";

import { useI18n } from "@/i18n/client";
import { LOCALE_META } from "@/i18n/config";
import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

const FORMATS: Record<string, Intl.DateTimeFormatOptions> = {
  time: { hour: "numeric", minute: "2-digit" },
  datetime: { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" },
  date: { month: "short", day: "numeric", year: "numeric" },
  month: { month: "short" },
  day: { day: "numeric" },
  weekday: { weekday: "short" },
};

/**
 * Formats a timestamp in the viewer's own time zone. Renders UTC on the
 * server, then corrects itself on the client without a hydration error.
 */
export function LocalTime({ date, format = "datetime", className }: { date: Date | string; format?: keyof typeof FORMATS; className?: string }) {
  const { locale } = useI18n();
  const d = new Date(date);
  const isClient = useSyncExternalStore(subscribe, () => true, () => false);
  const text = d.toLocaleString(LOCALE_META[locale].intl, { ...FORMATS[format], ...(isClient ? {} : { timeZone: "UTC" }) });
  return (
    <time dateTime={d.toISOString()} className={className} suppressHydrationWarning>
      {text}
    </time>
  );
}
