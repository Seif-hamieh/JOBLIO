// Article text: plain paragraphs (a blank line between them) with a little Markdown — "## " and "### " headings,
// **bold**, *italic*, "- " lists, "> " quotes and [links](https://…). Parsed into plain data and rendered as React
// elements (never as HTML), so nothing typed in an article can run as code. The app has the same rules.

export type Inline = { kind: "text" | "bold" | "italic"; text: string } | { kind: "link"; text: string; href: string };
export type Block = { kind: "h2" | "h3" | "p" | "quote"; inline: Inline[] } | { kind: "list"; items: Inline[][] };

const INLINE = /\*\*([^*]+)\*\*|\*([^*\s][^*]*)\*|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  let last = 0;
  for (const m of text.matchAll(INLINE)) {
    if (m.index > last) out.push({ kind: "text", text: text.slice(last, m.index) });
    if (m[1] !== undefined) out.push({ kind: "bold", text: m[1] });
    else if (m[2] !== undefined) out.push({ kind: "italic", text: m[2] });
    else out.push({ kind: "link", text: m[3]!, href: m[4]! });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ kind: "text", text: text.slice(last) });
  return out;
}

export function parseArticle(content: string): Block[] {
  const blocks: Block[] = [];
  let para: string[] = [];
  let list: string[] = [];
  let quote: string[] = [];
  const flush = () => {
    if (para.length) blocks.push({ kind: "p", inline: parseInline(para.join("\n")) });
    if (list.length) blocks.push({ kind: "list", items: list.map(parseInline) });
    if (quote.length) blocks.push({ kind: "quote", inline: parseInline(quote.join("\n")) });
    para = [];
    list = [];
    quote = [];
  };
  for (const raw of content.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trimEnd();
    const heading = /^(#{2,3})\s+(.+)$/.exec(line);
    const item = /^[-*]\s+(.+)$/.exec(line);
    const q = /^>\s?(.*)$/.exec(line);
    if (!line.trim()) flush();
    else if (heading) {
      flush();
      blocks.push({
        kind: heading[1] === "##" ? "h2" : "h3",
        inline: parseInline(heading[2]!),
      });
    } else if (item) {
      if (para.length || quote.length) flush();
      list.push(item[1]!);
    } else if (q) {
      if (para.length || list.length) flush();
      quote.push(q[1]!);
    } else {
      if (list.length || quote.length) flush();
      para.push(line);
    }
  }
  flush();
  return blocks;
}
