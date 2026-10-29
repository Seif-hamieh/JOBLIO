import { Fragment } from "react";
import { parseArticle, type Inline } from "@/lib/article-text";

/** An article's text, formatted (headings, paragraphs, lists, quotes, bold, italic, links) — as React, never HTML. */
export function ArticleBody({ content }: { content: string }) {
  return (
    <div className="space-y-5 text-[17px] leading-[1.75] text-fg">
      {parseArticle(content).map((b, i) => {
        if (b.kind === "h2")
          return (
            <h2 key={i} className="pt-3 font-display text-2xl font-semibold leading-snug">
              <Spans inline={b.inline} />
            </h2>
          );
        if (b.kind === "h3")
          return (
            <h3 key={i} className="pt-2 font-display text-xl font-semibold leading-snug">
              <Spans inline={b.inline} />
            </h3>
          );
        if (b.kind === "quote")
          return (
            <blockquote key={i} className="whitespace-pre-line border-s-4 border-brand ps-4 italic text-fg-muted">
              <Spans inline={b.inline} />
            </blockquote>
          );
        if (b.kind === "list")
          return (
            <ul key={i} className="list-disc space-y-1.5 ps-6">
              {b.items.map((item, j) => (
                <li key={j}>
                  <Spans inline={item} />
                </li>
              ))}
            </ul>
          );
        return (
          <p key={i} className="whitespace-pre-line">
            <Spans inline={b.inline} />
          </p>
        );
      })}
    </div>
  );
}

function Spans({ inline }: { inline: Inline[] }) {
  return inline.map((s, i) =>
    s.kind === "bold" ? (
      <strong key={i} className="font-semibold">
        {s.text}
      </strong>
    ) : s.kind === "italic" ? (
      <em key={i}>{s.text}</em>
    ) : s.kind === "link" ? (
      <a
        key={i}
        href={s.href}
        target="_blank"
        rel="noopener noreferrer nofollow ugc"
        className="text-brand-soft-fg underline underline-offset-2 hover:no-underline"
      >
        {s.text}
      </a>
    ) : (
      <Fragment key={i}>{s.text}</Fragment>
    ),
  );
}
