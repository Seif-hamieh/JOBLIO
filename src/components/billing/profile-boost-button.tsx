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
import type { ProfileBoostPlanCode } from "@/lib/billing/products";

export type ProfileBoostPlanOption = { code: ProfileBoostPlanCode; durationDays: number; amount: number };

/**
 * /premium: one button per Profile Boost plan (7/14/30 days). A click creates the Paddle
 * transaction on our server (POST /api/checkout { planCode }) and opens Paddle's checkout overlay —
 * the same flow as Featured Job, without a job to pick.
 */
export function ProfileBoostPicker({ plans, signedIn, config }: { plans: ProfileBoostPlanOption[]; signedIn: boolean; config: PaddleClientConfig }) {
  const router = useRouter();
  const { t, f, locale } = useI18n();
  const { resolvedTheme } = useTheme();
  const [busy, setBusy] = useState<ProfileBoostPlanCode | null>(null);
  const [paid, setPaid] = useState(false);

  async function start(planCode: ProfileBoostPlanCode) {
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
          toast.success(t("premium.boostPaid"));
          // The webhook grants the boost a moment later.
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
        {t("premium.boostPaid")}
      </p>
    );
  }
  return (
    <div role="group" aria-label={t("premium.boostPlans")} className="space-y-2">
      {plans.map((plan) => (
        <Button
          key={plan.code}
          variant={plan.durationDays === 14 ? "primary" : "outline"}
          className="w-full justify-between"
          loading={busy === plan.code}
          disabled={busy !== null && busy !== plan.code}
          onClick={() => start(plan.code)}
        >
          <span>
            {t("jobs.planDays", { n: plan.durationDays })} — {f.money(plan.amount)}
          </span>
          {plan.durationDays === 14 && (
            <Badge tone="mint" size="xs">
              {t("jobs.planPopular")}
            </Badge>
          )}
          {plan.durationDays === 30 && (
            <Badge tone="ember" size="xs">
              {t("premium.bestValue")}
            </Badge>
          )}
        </Button>
      ))}
    </div>
  );
}
