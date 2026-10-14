"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { useTheme } from "@/components/theme";
import { useI18n } from "@/i18n/client";
import { loadPaddle, setPaddleEventHandler, type PaddleClientConfig } from "@/components/jobs/feature-job-button";
import type { SubscriptionPlanCode, SubscriptionProductCode } from "@/lib/billing/products";

export type SubscriptionPlanOption = { code: SubscriptionPlanCode; interval: "month" | "year"; amount: number };

/**
 * /premium: monthly and yearly buttons for a subscription (Job Seeker Pro, Company Premium). A click
 * creates the first Paddle transaction on our server (POST /api/checkout { planCode }) and opens Paddle's
 * checkout overlay — the same flow as the one-time products. Paddle then owns the subscription.
 * Already subscribed → a link to manage it instead.
 */
export function SubscriptionPicker({
  product,
  plans,
  config,
  signedIn,
  isSubscribed,
  manageHref,
}: {
  product: SubscriptionProductCode;
  plans: SubscriptionPlanOption[];
  config: PaddleClientConfig;
  signedIn: boolean;
  isSubscribed: boolean;
  manageHref: string;
}) {
  const router = useRouter();
  const { t, f, locale } = useI18n();
  const { resolvedTheme } = useTheme();
  const [busy, setBusy] = useState<SubscriptionPlanCode | null>(null);
  const [paid, setPaid] = useState(false);

  // Yearly saving vs. 12 monthly payments, e.g. $70 vs $84 → 17%.
  const monthly = plans.find((p) => p.interval === "month");
  const yearly = plans.find((p) => p.interval === "year");
  const savePercent = monthly && yearly ? Math.round((1 - yearly.amount / (monthly.amount * 12)) * 100) : 0;

  async function start(planCode: SubscriptionPlanCode) {
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
          toast.success(t("premium.subscriptionPaid"));
          // The webhook records the subscription a moment later.
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

  if (isSubscribed) {
    return (
      <Link href={manageHref} className={buttonClasses({ variant: "soft", className: "w-full" })}>
        {t("premium.manageSubscription")}
      </Link>
    );
  }
  if (paid) {
    return (
      <p className="inline-flex items-center gap-2 text-sm font-medium text-mint-fg" role="status">
        <CheckCircle2 className="size-4" aria-hidden />
        {t("premium.subscriptionPaid")}
      </p>
    );
  }
  return (
    <div role="group" aria-label={`${t(`premium.products.${product}.name`)} — ${t("premium.subscriptionPlans")}`} className="space-y-2">
      {plans.map((plan) => (
        <Button
          key={plan.code}
          variant={plan.interval === "month" ? "primary" : "outline"}
          className="w-full justify-between"
          loading={busy === plan.code}
          disabled={busy !== null && busy !== plan.code}
          onClick={() => start(plan.code)}
        >
          <span>
            {plan.interval === "month" ? t("premium.planMonthly") : t("premium.planYearly")} — {f.money(plan.amount)}
          </span>
          {plan.interval === "month" ? (
            <Badge tone="mint" size="xs">
              {t("jobs.planPopular")}
            </Badge>
          ) : (
            <Badge tone="ember" size="xs">
              {t("premium.bestValue")}
              {savePercent > 0 && ` · ${t("premium.savePercent", { n: savePercent })}`}
            </Badge>
          )}
        </Button>
      ))}
    </div>
  );
}
