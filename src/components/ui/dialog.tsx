"use client";

import { useI18n } from "@/i18n/client";
import { Dialog as D } from "radix-ui";
import { AnimatePresence, m } from "motion/react";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = "md",
  trigger,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  trigger?: ReactNode;
}) {
  const { t } = useI18n();
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <D.Trigger asChild>{trigger}</D.Trigger>}
      <AnimatePresence>
        {open && (
          <D.Portal forceMount>
            <D.Overlay asChild forceMount>
              <m.div
                className="fixed inset-0 z-50 bg-[oklch(0.15_0.02_278/0.45)] backdrop-blur-[3px]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              />
            </D.Overlay>
            <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6">
              <D.Content asChild forceMount>
                <m.div
                  className={cn(
                    "relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-border bg-surface shadow-float sm:rounded-3xl",
                    size === "sm" && "sm:max-w-md",
                    size === "md" && "sm:max-w-lg",
                    size === "lg" && "sm:max-w-2xl",
                    size === "xl" && "sm:max-w-4xl",
                  )}
                  initial={{ opacity: 0, y: 24, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 16, scale: 0.98 }}
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                >
                  <div className="flex items-start justify-between gap-4 px-6 pb-2 pt-6">
                    <div>
                      <D.Title className="font-display text-lg font-semibold">{title}</D.Title>
                      {description ? (
                        <D.Description className="mt-1 text-sm text-fg-muted">{description}</D.Description>
                      ) : (
                        <D.Description className="sr-only">{typeof title === "string" ? title : ""}</D.Description>
                      )}
                    </div>
                    <D.Close className="-me-2 -mt-1 rounded-full p-2 text-fg-subtle transition hover:bg-surface-2 hover:text-fg" aria-label={t("common.close")}>
                      <X className="size-4" />
                    </D.Close>
                  </div>
                  <div className="overflow-y-auto px-6 pb-6 pt-2">{children}</div>
                  {footer && <div className="flex justify-end gap-2 border-t border-border bg-surface-2/60 px-6 py-4">{footer}</div>}
                </m.div>
              </D.Content>
            </div>
          </D.Portal>
        )}
      </AnimatePresence>
    </D.Root>
  );
}
