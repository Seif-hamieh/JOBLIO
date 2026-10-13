"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { CheckCircle2, Star } from "lucide-react";
import { initializePaddle, type Paddle, type PaddleEventData } from "@paddle/paddle-js";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { useTheme } from "@/components/theme";
import { useI18n } from "@/i18n/client";
import type { TKey } from "@/i18n/translate";
import type { FeaturedJobPlanCode } from "@/lib/billing/products";
import { cn } from "@/lib/utils";

export type PaddleClientConfig = { token: string; environment: "sandbox" | "production" };

// Paddle.js is loaded once, on the first click (not on page load).
let paddlePromise: Promise<Paddle | undefined> | null = null;
let onEvent: (event: PaddleEventData) => void = () => {};
function loadPaddle(config: PaddleClientConfig) {
  paddlePromise ??= initializePaddle({ token: config.token, environment: config.environment, eventCallback: (e) => onEvent(e) }).catch((err) => {
    paddlePromise = null;
    throw err;
  });
  return paddlePromise;
}

export type FeaturedJobPlanOption = { code: FeaturedJobPlanCode; durationDays: number; amount: number };

const PLAN_COPY: Record<number, { title: TKey; blurb: TKey; popular?: boolean }> = {
  7: { title: "jobs.planQuick", blurb: "jobs.planQuickSub" },
  14: { title: "jobs.planStandard", blurb: "jobs.planStandardSub", popular: true },
  30: { title: "jobs.planMax", blurb: "jobs.planMaxSub" },
};

/**
 * "Feature this job": choose a plan (7/14/30 days), then "Continue to payment" creates a
 * Paddle transaction on our server and opens Paddle's checkout overlay.
 */
export function FeatureJobButton({ jobId, config, plans, className }: { jobId: string; config: PaddleClientConfig; plans: FeaturedJobPlanOption[]; className?: string }) {
  const router = useRouter();
  const { t, f, locale } = useI18n();
  const { resolvedTheme } = useTheme();
  const name = useId();
  const [planCode, setPlanCode] = useState<FeaturedJobPlanCode | undefined>(() => (plans.find((p) => PLAN_COPY[p.durationDays]?.popular) ?? plans[0])?.code);
  const [state, setState] = useState<"idle" | "loading" | "open" | "paid">("idle");
  const refreshes = useRef<number[]>([]);

  async function start() {
    if (!planCode) return;
    setState("loading");
    try {
      const res = await fetch("/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jobId, planCode }) });
      const data = (await res.json().catch(() => ({}))) as { transactionId?: string; error?: string };
      if (!res.ok || !data.transactionId) throw new Error(data.error || t("premium.checkoutError"));

      const paddle = await loadPaddle(config);
      if (!paddle) throw new Error(t("premium.checkoutError"));
      onEvent = (event) => {
        if (event.name === "checkout.completed") {
          setState("paid");
          toast.success(t("jobs.featurePaid"));
          // The webhook grants the promotion a moment later; refresh to show the "Featured" badge.
          refreshes.current.forEach(clearTimeout);
          refreshes.current = [2500, 6000, 12000].map((ms) => window.setTimeout(() => router.refresh(), ms));
        } else if (event.name === "checkout.closed") {
          setState((s) => (s === "paid" ? s : "idle"));
        } else if (event.name === "checkout.error") {
          toast.error(t("premium.checkoutError"));
        }
      };
      paddle.Checkout.open({
        transactionId: data.transactionId,
        settings: { displayMode: "overlay", locale: locale === "ar" ? "ar" : "en", theme: resolvedTheme === "dark" ? "dark" : "light" },
      });
      setState("open");
    } catch (err) {
      setState("idle");
      toast.error(err instanceof Error && err.message ? err.message : t("premium.checkoutError"));
    }
  }

  if (state === "paid") {
    return (
      <p className="inline-flex items-center gap-2 text-sm font-medium text-mint-fg" role="status">
        <CheckCircle2 className="size-4" aria-hidden />
        {t("jobs.featurePaid")}
      </p>
    );
  }
  return (
    <div className={cn("space-y-3", className)}>
      <fieldset className="grid gap-2 sm:grid-cols-3" disabled={state !== "idle"}>
        <legend className="sr-only">{t("jobs.choosePlan")}</legend>
        {plans.map((plan) => {
          const copy = PLAN_COPY[plan.durationDays];
          return (
            <label
              key={plan.code}
              className="relative flex cursor-pointer flex-col gap-0.5 rounded-xl border border-border bg-surface p-3 text-start transition hover:border-brand/50 has-[:checked]:border-brand has-[:checked]:ring-2 has-[:checked]:ring-brand/30 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--ring)] has-[:disabled]:cursor-default"
            >
              <input type="radio" name={name} value={plan.code} checked={planCode === plan.code} onChange={() => setPlanCode(plan.code)} className="sr-only" />
              {copy?.popular && (
                <span className="absolute -top-2 end-3 rounded-full bg-brand px-2 py-0.5 text-[10px] font-semibold text-brand-fg">{t("jobs.planPopular")}</span>
              )}
              <span className="text-sm font-semibold">{copy ? t(copy.title) : t("jobs.planDays", { n: plan.durationDays })}</span>
              <span className="font-display text-xl font-semibold">{f.money(plan.amount)}</span>
              <span className="text-xs text-fg-muted">{t("jobs.planDays", { n: plan.durationDays })}</span>
              {copy && <span className="mt-1 text-xs text-fg-subtle">{t(copy.blurb)}</span>}
            </label>
          );
        })}
      </fieldset>
      <Button className="w-full sm:w-auto" loading={state === "loading"} disabled={!planCode || state === "open"} onClick={start}>
        <Star aria-hidden />
        {t("jobs.continueToPayment")}
      </Button>
    </div>
  );
}

/**
 * Paddle's "default payment link" lands on /premium?_ptxn=txn_…; Paddle.js opens the
 * checkout for that transaction by itself once it is initialised on the page.
 */
export function PaddlePaymentLink({ config }: { config: PaddleClientConfig }) {
  const router = useRouter();
  const { t } = useI18n();
  useEffect(() => {
    onEvent = (event) => {
      if (event.name === "checkout.completed") {
        toast.success(t("jobs.featurePaid"));
        window.setTimeout(() => router.push("/settings/billing"), 3000);
      }
    };
    loadPaddle(config).catch(() => toast.error(t("premium.checkoutError")));
  }, [config, router, t]);
  return null;
}

/** /premium: pick one of your featurable jobs, then pay with Paddle. */
export function FeatureJobPicker({ jobs, initialJob, config, plans }: { jobs: { id: string; title: string }[]; initialJob: string | null; config: PaddleClientConfig; plans: FeaturedJobPlanOption[] }) {
  const { t } = useI18n();
  const [jobId, setJobId] = useState(initialJob && jobs.some((j) => j.id === initialJob) ? initialJob : (jobs[0]?.id ?? ""));
  if (!jobs.length) return <p className="text-xs text-fg-subtle">{t("premium.noFeaturableJobs")}</p>;
  return (
    <div className="space-y-2">
      <Select value={jobId} onChange={(e) => setJobId(e.target.value)} aria-label={t("premium.jobToPromote")}>
        {jobs.map((j) => (
          <option key={j.id} value={j.id}>
            {j.title}
          </option>
        ))}
      </Select>
      <FeatureJobButton key={jobId} jobId={jobId} config={config} plans={plans} className="[&_fieldset]:grid-cols-1" />
    </div>
  );
}
