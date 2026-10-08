"use client";

import { useI18n } from "@/i18n/client";
import { useState } from "react";
import { cn } from "@/lib/utils";

const URL_RE = /(https?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]])/g;

/** Plain text with safe auto-linking (http/https only) and "see more" folding. */
export function RichText({ text, clamp = 320, className }: { text: string; clamp?: number; className?: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const long = text.length > clamp;
  const shown = long && !open ? `${text.slice(0, clamp).trimEnd()}…` : text;
  const parts = shown.split(URL_RE);
  return (
    // dir="auto": member-written text follows its own language, not the UI's.
    <div dir="auto" className={cn("whitespace-pre-line break-words text-[15px] leading-relaxed", className)}>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer nofollow ugc" className="font-medium text-brand-soft-fg hover:underline">
            {part.replace(/^https?:\/\//, "").slice(0, 48)}
          </a>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
      {long && (
        <button type="button" onClick={() => setOpen((o) => !o)} className="ms-1 text-sm font-semibold text-fg-muted hover:text-fg">
          {open ? t("feed.showLess") : t("feed.seeMore")}
        </button>
      )}
    </div>
  );
}
