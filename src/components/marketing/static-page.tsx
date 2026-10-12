import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { getI18n } from "@/i18n/server";
import { STATIC_PAGES, type StaticPageId } from "@/content/static-pages";
import { cn } from "@/lib/utils";

const NAV: StaticPageId[] = ["about", "terms", "privacy", "contact"];

export function staticPageMetadata(id: StaticPageId) {
  return async (): Promise<Metadata> => {
    const { locale } = await getI18n();
    const page = STATIC_PAGES[id][locale];
    return { title: page.title, description: page.intro, alternates: { canonical: `/${id}` } };
  };
}

/** Layout shared by About / Terms / Privacy / Contact: readable column + links between them. */
export async function StaticPageView({ id, children }: { id: StaticPageId; children?: ReactNode }) {
  const { locale } = await getI18n();
  const page = STATIC_PAGES[id][locale];
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <nav aria-label={page.title} className="scrollbar-none -mx-1 flex gap-1 overflow-x-auto px-1">
        {NAV.map((n) => (
          <Link
            key={n}
            href={`/${n}`}
            aria-current={n === id ? "page" : undefined}
            className={cn(
              "shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition",
              n === id ? "bg-surface text-fg shadow-soft ring-1 ring-border" : "text-fg-muted hover:text-fg",
            )}
          >
            {STATIC_PAGES[n][locale].title}
          </Link>
        ))}
      </nav>
      <h1 className="mt-8 font-display text-3xl font-semibold tracking-tight sm:text-4xl">{page.title}</h1>
      {page.updated && <p className="mt-2 text-sm text-fg-subtle">{page.updated}</p>}
      <p className="mt-5 text-lg leading-relaxed text-fg-muted">{page.intro}</p>
      {children}
      <div className="mt-10 space-y-9">
        {page.sections.map((s) => (
          <section key={s.heading} id={s.heading} className="scroll-mt-24">
            <h2 className="font-display text-xl font-semibold">{s.heading}</h2>
            {s.body.map((p) => (
              <p key={p} className="mt-3 leading-relaxed text-fg-muted">
                {p}
              </p>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
