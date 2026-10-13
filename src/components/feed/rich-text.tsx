"use client";

import Link from "next/link";
import { useI18n } from "@/i18n/client";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const URL_RE = /(https?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]])/g;
// #hashtag / @mention at the start or after whitespace or an opening bracket; letters in any script.
const TAG_RE = /(^|[\s(])([#@][\p{L}\p{N}_](?:[\p{L}\p{N}_.-]*[\p{L}\p{N}_])?)/gu;
const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{1,38}$/i;

const linkClass = "font-medium text-brand-soft-fg hover:underline";

/** #tags open the unified search; @username opens that member's profile. */
function withTags(text: string, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(TAG_RE)) {
    const [, lead, token] = m as unknown as [string, string, string];
    const start = m.index! + lead.length;
    const word = token.slice(1);
    const isMention = token[0] === "@";
    if (isMention && !USERNAME_RE.test(word)) continue;
    out.push(text.slice(last, start));
    out.push(
      <Link key={`${keyPrefix}-${start}`} href={isMention ? `/in/${word}` : `/search?q=${encodeURIComponent(word)}`} className={linkClass} dir="auto">
        {token}
      </Link>,
    );
    last = start + token.length;
  }
  out.push(text.slice(last));
  return out;
}

/** Plain text with safe auto-linking (http/https, #tags, @mentions) and "see more" folding. */
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
          <a key={i} href={part} target="_blank" rel="noopener noreferrer nofollow ugc" className={linkClass}>
            {part.replace(/^https?:\/\//, "").slice(0, 48)}
          </a>
        ) : (
          <span key={i}>{withTags(part, String(i))}</span>
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
