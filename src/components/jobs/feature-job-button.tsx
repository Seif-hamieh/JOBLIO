"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Star } from "lucide-react";
import { initializePaddle, type Paddle, type PaddleEventData } from "@paddle/paddle-js";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { useTheme } from "@/components/theme";
import { useI18n } from "@/i18n/client";

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

/** "Feature this job for $20": creates a Paddle transaction on our server, then opens Paddle's checkout overlay. */
export function FeatureJobButton({ jobId, config, label, ...props }: { jobId: string; config: PaddleClientConfig; label: string } & Omit<ButtonProps, "onClick" | "children">) {
  const router = useRouter();
  const { t, locale } = useI18n();
  const { resolvedTheme } = useTheme();
  const [state, setState] = useState<"idle" | "loading" | "open" | "paid">("idle");
  const refreshes = useRef<number[]>([]);

  async function start() {
    setState("loading");
    try {
      const res = await fetch("/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jobId, productCode: "FEATURED_JOB" }) });
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
    <Button {...props} loading={state === "loading"} disabled={state === "open"} onClick={start}>
      <Star aria-hidden />
      {label}
    </Button>
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
export function FeatureJobPicker({ jobs, initialJob, config, label }: { jobs: { id: string; title: string }[]; initialJob: string | null; config: PaddleClientConfig; label: string }) {
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
      <FeatureJobButton key={jobId} jobId={jobId} config={config} label={label} className="w-full" variant="outline" />
    </div>
  );
}
