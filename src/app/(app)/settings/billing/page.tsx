import Link from "next/link";
import { CheckCircle2, Crown, ExternalLink, Rocket } from "lucide-react";
import { getI18n, pageTitle } from "@/i18n/server";
import { requireViewer } from "@/server/session";
import { db } from "@/server/db";
import { paddleCustomerIdFor } from "@/server/billing";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, EmptyState, PageHeader } from "@/components/ui/misc";
import { buttonClasses } from "@/components/ui/button";
import { ManageSubscriptionButton, PaymentMethodsButton, SubscriptionToggle } from "@/components/settings/settings-forms";
import { featuredJobDays } from "@/lib/billing/products";

export const generateMetadata = pageTitle("nav.billing");

const PAYMENT_TONE = { PENDING: "ember", SUCCEEDED: "mint", FAILED: "danger", REFUNDED: "neutral" } as const;

export default async function BillingPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const [viewer, { t, f }] = await Promise.all([requireViewer(), getI18n()]);
  const companyScope = viewer.company ? [{ companyId: viewer.company.id }] : [];
  const [subs, payments, profile, paddleCustomerId] = await Promise.all([
    db.subscription.findMany({
      where: { OR: [{ userId: viewer.id }, ...companyScope], status: { notIn: ["CANCELED", "INCOMPLETE"] }, currentPeriodEnd: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
      select: { id: true, product: true, status: true, currentPeriodEnd: true, cancelAtPeriodEnd: true, userId: true },
    }),
    db.payment.findMany({
      where: { OR: [{ userId: viewer.id }, ...companyScope] },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, product: true, description: true, amount: true, currency: true, status: true, invoiceNumber: true, createdAt: true, receiptUrl: true },
    }),
    db.profile.findUnique({ where: { id: viewer.profileId }, select: { featuredUntil: true } }),
    paddleCustomerIdFor(viewer.id),
  ]);
  const boostEnds = profile?.featuredUntil && profile.featuredUntil > new Date() ? profile.featuredUntil : null;
  // Paddle's customer portal (manage subscriptions, payment methods, invoices) exists once the member has a Paddle customer.
  const hasPortal = !!paddleCustomerId;

  return (
    <div className="space-y-6">
      <PageHeader title={t("billing.title")} description={t("billing.sub")} />

      {sp.success && (
        <p className="flex items-center gap-2 rounded-2xl border border-mint/30 bg-mint-soft px-4 py-3 text-sm text-mint-fg">
          <CheckCircle2 className="size-5 shrink-0" /> {t("billing.success")}
        </p>
      )}

      <Card className="p-6 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <CardHeader title={t("billing.subscriptions")} />
          {hasPortal && subs.some((s) => s.userId === viewer.id) && <ManageSubscriptionButton />}
        </div>
        <ul className="mt-4 space-y-3">
          {boostEnds && (
            <li className="flex flex-wrap items-center gap-3 rounded-2xl border border-ember/30 bg-ember-soft/40 p-4">
              <Rocket className="size-5 text-ember-fg" />
              <span className="flex-1 text-sm font-medium">{t("billing.boostActive", { date: f.date(boostEnds, { month: "long", day: "numeric" }) })}</span>
            </li>
          )}
          {subs.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-border p-4">
              <Crown className="size-5 text-brand" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  {t(`premium.products.${s.product}.name`)}
                  <Badge tone={s.status === "PAST_DUE" ? "danger" : "mint"} size="xs">
                    {t(`billing.subStatus.${s.status}`)}
                  </Badge>
                </div>
                <div className="text-xs text-fg-muted">
                  {s.cancelAtPeriodEnd
                    ? t("billing.endsOn", { date: f.date(s.currentPeriodEnd, { month: "long", day: "numeric", year: "numeric" }) })
                    : t("billing.renewsOn", { date: f.date(s.currentPeriodEnd, { month: "long", day: "numeric", year: "numeric" }) })}
                </div>
              </div>
              {s.userId === viewer.id && <SubscriptionToggle subscriptionId={s.id} cancelAtPeriodEnd={s.cancelAtPeriodEnd} />}
            </li>
          ))}
          {subs.length === 0 && !boostEnds && (
            <li className="flex flex-wrap items-center justify-between gap-3 text-sm text-fg-muted">
              {t("billing.noSubscription")}
              <Link href="/premium" className={buttonClasses({ size: "sm", variant: "soft", pill: true })}>
                <Crown /> {t("billing.explore")}
              </Link>
            </li>
          )}
        </ul>
      </Card>

      <Card className="p-6 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <CardHeader title={t("billing.payMethods")} description={t("billing.payMethodsSub")} />
          {hasPortal ? <PaymentMethodsButton /> : <p className="max-w-xs text-xs text-fg-subtle">{t("billing.noStripe")}</p>}
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="p-6 pb-3 sm:px-7">
          <CardHeader title={t("billing.history")} />
        </div>
        {payments.length === 0 ? (
          <div className="p-6 pt-0">
            <EmptyState title={t("billing.noHistory")} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-y border-border bg-surface-2/60 text-xs text-fg-muted">
                  <th className="px-6 py-2.5 text-start font-medium">{t("billing.date")}</th>
                  <th className="px-3 py-2.5 text-start font-medium">{t("billing.item")}</th>
                  <th className="px-3 py-2.5 text-end font-medium">{t("billing.amount")}</th>
                  <th className="px-3 py-2.5 text-start font-medium">{t("common.status")}</th>
                  <th className="px-6 py-2.5 text-end font-medium">{t("billing.invoice")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td className="px-6 py-3 text-fg-muted">{f.date(p.createdAt, { month: "short", day: "numeric", year: "numeric" })}</td>
                    <td className="px-3 py-3 font-medium">
                      {t(`premium.products.${p.product}.name`)}
                      {featuredJobDays(p) && <span className="font-normal text-fg-muted"> · {t("jobs.planDays", { n: featuredJobDays(p)! })}</span>}
                    </td>
                    <td className="px-3 py-3 text-end tabular-nums">{f.money(p.amount, p.currency)}</td>
                    <td className="px-3 py-3">
                      <Badge tone={PAYMENT_TONE[p.status]} size="xs">
                        {t(`billing.statusLabel.${p.status}`)}
                      </Badge>
                    </td>
                    <td className="px-6 py-3 text-end">
                      <div className="inline-flex items-center gap-3">
                        <Link href={`/settings/billing/${p.invoiceNumber}`} className="font-medium text-brand-soft-fg hover:underline">
                          {t("billing.view")}
                        </Link>
                        {p.receiptUrl && (
                          <a href={p.receiptUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-fg-muted hover:text-fg">
                            {t("billing.receipt")} <ExternalLink className="size-3" />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
