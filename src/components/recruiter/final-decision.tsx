"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, m } from "motion/react";
import { Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/components/ui/toast";
import { useI18n } from "@/i18n/client";

// Hiring, declining and moving someone out of Hired all send the candidate a
// notification, so they are confirmed first and then held for UNDO_SECONDS in
// the browser before the server is told. Undo within that window leaves no
// trace and sends nothing. (Vercel functions can't run a delayed job, so the
// wait lives client-side; leaving the page commits immediately.)

export const UNDO_SECONDS = 10;

type Result = { ok: boolean; message?: string; error?: string } | null;

export type FinalDecision = {
  /** hire → Hired, decline → Not selected, reopen → out of Hired into another stage. */
  kind: "hire" | "decline" | "reopen";
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

const COPY = {
  hire: { title: "recruiter.confirmHireTitle", body: "recruiter.confirmHireBody", action: "recruiter.markHired", pending: "recruiter.pendingHire", danger: false },
  decline: { title: "recruiter.confirmDeclineTitle", body: "recruiter.confirmDeclineBody", action: "recruiter.decline", pending: "recruiter.pendingDecline", danger: true },
  reopen: { title: "recruiter.confirmReopenTitle", body: "recruiter.confirmReopenBody", action: "recruiter.leaveHired", pending: "recruiter.pendingReopen", danger: true },
} as const;

export function FinalDecisionProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [asking, setAsking] = useState<FinalDecision | null>(null);
  const [pending, setPending] = useState<FinalDecision | null>(null);
  const [left, setLeft] = useState(UNDO_SECONDS);
  const pendingRef = useRef<FinalDecision | null>(null);
  // An absolute deadline, not a countdown: background tabs throttle timers, so
  // elapsed time is always measured against the clock.
  const deadline = useRef(0);
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
    deadline.current = Date.now() + UNDO_SECONDS * 1000;
    setPending(d);
    setLeft(UNDO_SECONDS);
    timer.current = setTimeout(flush, UNDO_SECONDS * 1000);
  };

  const undo = () => {
    const d = pendingRef.current;
    if (!d) return;
    // A throttled timer may not have fired yet although the window is over: then it's too late to undo.
    if (Date.now() >= deadline.current) return flush();
    if (timer.current) clearTimeout(timer.current);
    pendingRef.current = null;
    setPending(null);
    d.revert();
    toast.info(t("recruiter.decisionUndone"));
  };

  // Countdown shown in the bar, derived from the deadline.
  useEffect(() => {
    if (!pending) return;
    const tick = setInterval(() => {
      const ms = deadline.current - Date.now();
      setLeft(Math.max(0, Math.ceil(ms / 1000)));
      if (ms <= 0) flush();
    }, 250);
    return () => clearInterval(tick);
  }, [pending, flush]);

  // Coming back to a background tab: commit at once if the window already ended.
  useEffect(() => {
    if (!pending) return;
    const onVisible = () => document.visibilityState === "visible" && Date.now() >= deadline.current && flush();
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [pending, flush]);

  // Warn before closing the tab with a decision still waiting.
  useEffect(() => {
    if (!pending) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [pending]);

  // Navigating away inside the app: save right away rather than drop it.
  useEffect(() => () => flush(), [flush]);

  const copy = COPY[asking?.kind ?? "decline"];
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
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
        title={t(copy.title, { name: asking?.candidate ?? "" })}
        description={t(copy.body, { name: asking?.candidate ?? "", s: UNDO_SECONDS })}
        confirmLabel={t(copy.action)}
        danger={copy.danger}
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
                <span className="min-w-0 flex-1">{t(COPY[pending.kind].pending, { name: pending.candidate, s: left })}</span>
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
