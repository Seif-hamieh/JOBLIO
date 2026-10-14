"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { useTheme } from "@/components/theme";
import { useI18n } from "@/i18n/client";
import { loadPaddle, setPaddleEventHandler, type PaddleClientConfig } from "@/components/jobs/feature-job-button";
import type { PriorityApplicationPlanCode } from "@/lib/billing/products";

export type PriorityApplicationPlanOption = { code: PriorityApplicationPlanCode; credits: number; amount: number };

/**
 * /premium: one button per Priority Application pack (1/5/10 credits). A click creates the Paddle
 * transaction on our server (POST /api/checkout { planCode }) and opens Paddle's checkout overlay —
 * the same flow as Profile Boost. Each credit puts one future application at the top of the list.
 */
export function PriorityApplicationPicker({ plans, signedIn, config }: { plans: PriorityApplicationPlanOption[]; signedIn: boolean; config: PaddleClientConfig }) {
  const router = useRouter();
  const { t, f, locale } = useI18n();
  const { resolvedTheme } = useTheme();
  const [busy, setBusy] = useState<PriorityApplicationPlanCode | null>(null);
  const [paid, setPaid] = useState(false);

  async function start(planCode: PriorityApplicationPlanCode) {
    if (!signedIn) return router.push("/login?next=/premium");
    setBusy(planCode);
    try {
      const res = await fetch("/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ planCode }) });
      const data = (await res.json().catch(() => ({}))) as { transactionId?: string; error?: string };
      if (!res.ok || !data.transactionId) throw new Error(data.error || t("premium.checkoutError"));

      const paddle = await loadPaddle(config);
      if (!paddle) throw new Error(t("premium.checkoutError"));
      setPaddleEventHandler((event) => {
        if (event.name === "checkout.completed") {
          setPaid(true);
          toast.success(t("premium.priorityPaid"));
          // The webhook adds the credits a moment later.
          [2500, 6000, 12000].forEach((ms) => window.setTimeout(() => router.refresh(), ms));
        } else if (event.name === "checkout.closed") {
          setBusy(null);
        } else if (event.name === "checkout.error") {
          toast.error(t("premium.checkoutError"));
        }
      });
      paddle.Checkout.open({
        transactionId: data.transactionId,
        settings: { displayMode: "overlay", locale: locale === "ar" ? "ar" : "en", theme: resolvedTheme === "dark" ? "dark" : "light" },
      });
    } catch (err) {
      setBusy(null);
      toast.error(err instanceof Error && err.message ? err.message : t("premium.checkoutError"));
    }
  }

  if (paid) {
    return (
      <p className="inline-flex items-center gap-2 text-sm font-medium text-mint-fg" role="status">
        <CheckCircle2 className="size-4" aria-hidden />
        {t("premium.priorityPaid")}
      </p>
    );
  }
  return (
    <div role="group" aria-label={t("premium.priorityPacks")} className="space-y-2">
      {plans.map((plan) => (
        <Button
          key={plan.code}
          variant={plan.credits === 5 ? "primary" : "outline"}
          className="w-full justify-between"
          loading={busy === plan.code}
          disabled={busy !== null && busy !== plan.code}
          onClick={() => start(plan.code)}
        >
          <span>
            {t("premium.priorityPack", { n: plan.credits })} — {f.money(plan.amount)}
          </span>
          {plan.credits === 5 && (
            <Badge tone="mint" size="xs">
              {t("jobs.planPopular")}
            </Badge>
          )}
          {plan.credits === 10 && (
            <Badge tone="ember" size="xs">
              {t("premium.bestValue")}
            </Badge>
          )}
        </Button>
      ))}
    </div>
  );
}
