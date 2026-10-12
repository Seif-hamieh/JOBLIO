"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, m } from "motion/react";
import { Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/components/ui/toast";
import { useI18n } from "@/i18n/client";

// Hiring or declining a candidate sends them a final notification, so it is
// confirmed first and then held for UNDO_SECONDS in the browser before the
// server is told. Undo within that window leaves no trace and sends nothing.
// (Vercel functions can't run a delayed job, so the wait lives client-side;
// leaving the page commits immediately so a decision is never lost.)

export const UNDO_SECONDS = 10;

type Result = { ok: boolean; message?: string; error?: string } | null;

export type FinalDecision = {
  kind: "hire" | "decline";
  candidate: string;
  /** Show the new state optimistically (called once the recruiter confirms). */
  apply: () => void;
  /** Put the previous state back (cancel, undo, or a server error). */
  revert: () => void;
  /** Save on the server — this is what notifies the candidate. */
  commit: () => Promise<Result>;
  /** Called after a successful commit. */
  onCommitted?: () => void;
};

const Ctx = createContext<((d: FinalDecision) => void) | null>(null);
const noopSubscribe = () => () => {};

/** Ask for a final decision; null outside a FinalDecisionProvider. */
export const useFinalDecision = () => useContext(Ctx);

export function FinalDecisionProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [asking, setAsking] = useState<FinalDecision | null>(null);
  const [pending, setPending] = useState<FinalDecision | null>(null);
  const [left, setLeft] = useState(UNDO_SECONDS);
  const pendingRef = useRef<FinalDecision | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const commit = useCallback(
    async (d: FinalDecision) => {
      const res = await d.commit().catch(() => null);
      if (res?.ok) {
        if (res.message) toast.success(res.message);
        d.onCommitted?.();
      } else {
        d.revert();
        toast.error(res?.error ?? t("common.somethingWrong"));
      }
    },
    [t],
  );

  const flush = useCallback(() => {
    const d = pendingRef.current;
    if (!d) return;
    if (timer.current) clearTimeout(timer.current);
    pendingRef.current = null;
    setPending(null);
    void commit(d);
  }, [commit]);

  const begin = (d: FinalDecision) => {
    flush(); // only one decision waits at a time
    d.apply();
    pendingRef.current = d;
    setPending(d);
    setLeft(UNDO_SECONDS);
    timer.current = setTimeout(flush, UNDO_SECONDS * 1000);
  };

  const undo = () => {
    const d = pendingRef.current;
    if (!d) return;
    if (timer.current) clearTimeout(timer.current);
    pendingRef.current = null;
    setPending(null);
    d.revert();
    toast.info(t("recruiter.decisionUndone"));
  };

  // Countdown shown in the bar.
  useEffect(() => {
    if (!pending) return;
    const tick = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(tick);
  }, [pending]);

  // Warn before closing the tab with a decision still waiting.
  useEffect(() => {
    if (!pending) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [pending]);

  // Navigating away inside the app: save right away rather than drop it.
  useEffect(() => () => flush(), [flush]);

  const hire = asking?.kind === "hire";
  const mounted = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  return (
    <Ctx.Provider value={setAsking}>
      {children}
      <ConfirmDialog
        open={!!asking}
        onOpenChange={(open) => {
          if (!open && asking) {
            asking.revert();
            setAsking(null);
          }
        }}
        title={
          hire
            ? t("recruiter.confirmHireTitle", { name: asking?.candidate ?? "" })
            : t("recruiter.confirmDeclineTitle", {
                name: asking?.candidate ?? "",
              })
        }
        description={hire ? t("recruiter.confirmHireBody", { s: UNDO_SECONDS }) : t("recruiter.confirmDeclineBody", { s: UNDO_SECONDS })}
        confirmLabel={hire ? t("recruiter.markHired") : t("recruiter.decline")}
        danger={!hire}
        onConfirm={() => {
          const d = asking;
          setAsking(null);
          if (d) begin(d);
        }}
      />
      {/* Portalled to <body>: page transitions create a stacking context that would put the bar under dialogs. */}
      {mounted &&
        createPortal(
          <AnimatePresence>
            {pending && (
              <m.div
                role="status"
                aria-live="polite"
                data-final-decision-bar
                // A modal (e.g. the applicant drawer) disables pointer events on <body>; the bar must stay clickable.
                style={{ pointerEvents: "auto" }}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 16 }}
                className="fixed inset-x-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-[90] mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-fg px-4 py-3 text-sm text-bg shadow-float lg:bottom-6"
              >
                <span className="min-w-0 flex-1">
                  {pending.kind === "hire"
                    ? t("recruiter.pendingHire", {
                        name: pending.candidate,
                        s: left,
                      })
                    : t("recruiter.pendingDecline", {
                        name: pending.candidate,
                        s: left,
                      })}
                </span>
                <Button size="sm" variant="outline" onClick={undo} className="shrink-0 border-bg/30 bg-transparent text-bg hover:bg-bg/10">
                  <Undo2 /> {t("recruiter.undo")}
                </Button>
              </m.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </Ctx.Provider>
  );
}
