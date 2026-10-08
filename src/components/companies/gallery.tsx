"use client";

import { useI18n } from "@/i18n/client";
import { useEffect, useState } from "react";
import { AnimatePresence, m } from "motion/react";
import { ChevronLeft, ChevronRight, Play, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type MediaItem = { id: string; type: "PHOTO" | "VIDEO"; url: string; caption: string | null };

/** "Life at the company" gallery with a keyboard-accessible lightbox. */
export function CompanyGallery({ items }: { items: MediaItem[] }) {
  const { t, dir } = useI18n();
  const [index, setIndex] = useState<number | null>(null);
  const current = index != null ? items[index] : null;

  useEffect(() => {
    if (index == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIndex(null);
      const step = dir === "rtl" ? -1 : 1;
      if (e.key === "ArrowRight") setIndex((i) => (i! + step + items.length) % items.length);
      if (e.key === "ArrowLeft") setIndex((i) => (i! - step + items.length) % items.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, items.length, dir]);

  if (!items.length) return null;
  return (
    <>
      <div className="grid auto-rows-[140px] grid-cols-2 gap-2 sm:auto-rows-[170px] sm:grid-cols-4">
        {items.map((it, i) => (
          <button
            key={it.id}
            type="button"
            onClick={() => setIndex(i)}
            className={cn("group relative overflow-hidden rounded-2xl bg-surface-2", i === 0 && "col-span-2 row-span-2")}
            aria-label={it.caption ?? t("companies.openPhoto", { n: i + 1 })}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={it.url} alt={it.caption ?? ""} loading="lazy" className="size-full object-cover transition duration-500 group-hover:scale-105" />
            {it.type === "VIDEO" && (
              <span className="absolute inset-0 grid place-items-center bg-black/25">
                <Play className="size-10 fill-white text-white" />
              </span>
            )}
            {it.caption && (
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-3 text-start text-xs font-medium text-white opacity-0 transition group-hover:opacity-100">
                {it.caption}
              </span>
            )}
          </button>
        ))}
      </div>
      <AnimatePresence>
        {current && (
          <m.div
            className="fixed inset-0 z-[80] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIndex(null)}
            role="dialog"
            aria-modal="true"
            aria-label={current.caption ?? t("companyDash.addPhoto")}
          >
            <button className="absolute end-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20" aria-label={t("common.close")}>
              <X className="size-5" />
            </button>
            {items.length > 1 && (
              <>
                <button
                  className="absolute start-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIndex((i) => (i! - 1 + items.length) % items.length);
                  }}
                  aria-label={t("common.previous")}
                >
                  <ChevronLeft className="size-6" />
                </button>
                <button
                  className="absolute end-4 top-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIndex((i) => (i! + 1) % items.length);
                  }}
                  aria-label={t("common.nextPage")}
                >
                  <ChevronRight className="size-6" />
                </button>
              </>
            )}
            <m.figure key={current.id} initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="max-h-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
              {current.type === "VIDEO" ? (
                <video src={current.url} controls autoPlay className="max-h-[80vh] rounded-2xl" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={current.url} alt={current.caption ?? ""} className="max-h-[80vh] rounded-2xl object-contain" />
              )}
              {current.caption && <figcaption className="mt-3 text-center text-sm text-white/80">{current.caption}</figcaption>}
            </m.figure>
          </m.div>
        )}
      </AnimatePresence>
    </>
  );
}
