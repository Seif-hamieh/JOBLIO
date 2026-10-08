"use client";

import { useI18n } from "@/i18n/client";
import { AnimatePresence, m } from "motion/react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

type ToastTone = "success" | "error" | "info";
type ToastItem = { id: number; tone: ToastTone; title: string; description?: string };

let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function push(tone: ToastTone, title: string, description?: string) {
  const id = nextId++;
  items = [...items.slice(-3), { id, tone, title, description }];
  emit();
  setTimeout(() => dismiss(id), tone === "error" ? 6000 : 3800);
}

function dismiss(id: number) {
  items = items.filter((t) => t.id !== id);
  emit();
}

export const toast = {
  success: (title: string, description?: string) => push("success", title, description),
  error: (title: string, description?: string) => push("error", title, description),
  info: (title: string, description?: string) => push("info", title, description),
};

const EMPTY: ToastItem[] = [];

export function Toaster() {
  const { t: tr } = useI18n();
  const list = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => items,
    () => EMPTY,
  );
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 sm:bottom-6 sm:items-end sm:pe-6" aria-live="polite">
      <AnimatePresence initial={false}>
        {list.map((t) => (
          <m.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.15 } }}
            transition={{ type: "spring", stiffness: 500, damping: 36 }}
            className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border border-border bg-surface p-3.5 shadow-float"
            role={t.tone === "error" ? "alert" : "status"}
          >
            <span
              className={cn(
                "mt-0.5 [&_svg]:size-5",
                t.tone === "success" && "text-mint",
                t.tone === "error" && "text-danger",
                t.tone === "info" && "text-brand",
              )}
            >
              {t.tone === "success" ? <CheckCircle2 /> : t.tone === "error" ? <AlertCircle /> : <Info />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{t.title}</p>
              {t.description && <p className="mt-0.5 text-[13px] text-fg-muted">{t.description}</p>}
            </div>
            <button onClick={() => dismiss(t.id)} className="rounded-full p-1 text-fg-subtle hover:bg-surface-2 hover:text-fg" aria-label={tr("common.close")}>
              <X className="size-3.5" />
            </button>
          </m.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
