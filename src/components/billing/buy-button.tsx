"use client";

import { useI18n } from "@/i18n/client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { checkoutAction } from "@/server/actions/billing";
import type { ProductCode } from "@/lib/billing/products";

export function BuyButton({
  product,
  targetId,
  signedIn,
  disabled,
  children,
  ...props
}: { product: ProductCode; targetId?: string | null; signedIn: boolean } & Omit<ButtonProps, "onClick">) {
  const router = useRouter();
  const { t } = useI18n();
  const [pending, start] = useTransition();
  return (
    <Button
      {...props}
      disabled={disabled}
      loading={pending}
      onClick={() => {
        if (!signedIn) return router.push(`/login?next=/premium`);
        start(async () => {
          const res = await checkoutAction(product, targetId);
          if (res?.ok && res.data) {
            // Stripe Checkout (or the dev simulator) — a full navigation either way.
            window.location.assign(res.data.url);
          } else toast.error(res && !res.ok ? res.error : t("premium.checkoutError"));
        });
      }}
    >
      {children}
    </Button>
  );
}

export function PromoteJobBuy({ product, jobs, initialJob, signedIn, label }: { product: "FEATURED_JOB" | "SPONSORED_JOB"; jobs: { id: string; title: string }[]; initialJob: string | null; signedIn: boolean; label: string }) {
  const { t } = useI18n();
  const [jobId, setJobId] = useState(initialJob && jobs.some((j) => j.id === initialJob) ? initialJob : (jobs[0]?.id ?? ""));
  if (!jobs.length) return <p className="text-xs text-fg-subtle">{t("premium.publishToPromote")}</p>;
  return (
    <div className="space-y-2">
      <Select value={jobId} onChange={(e) => setJobId(e.target.value)} aria-label={t("premium.jobToPromote")}>
        {jobs.map((j) => (
          <option key={j.id} value={j.id}>
            {j.title}
          </option>
        ))}
      </Select>
      <BuyButton product={product} targetId={jobId} signedIn={signedIn} className="w-full" variant="outline">
        {label}
      </BuyButton>
    </div>
  );
}
