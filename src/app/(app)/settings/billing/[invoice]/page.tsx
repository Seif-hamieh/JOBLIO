import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getI18n, pageTitle } from "@/i18n/server";
import { requireViewer } from "@/server/session";
import { db } from "@/server/db";
import { Logo } from "@/components/brand/logo";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/misc";
import { PrintButton } from "@/components/settings/settings-forms";
import { featuredJobDays } from "@/lib/billing/products";

export const generateMetadata = pageTitle("billing.invoice");

export default async function InvoicePage({ params }: { params: Promise<{ invoice: string }> }) {
  const { invoice } = await params;
  const [viewer, { t, f }] = await Promise.all([requireViewer(), getI18n()]);
  const payment = await db.payment.findUnique({
    where: { invoiceNumber: invoice },
    select: {
      userId: true,
      companyId: true,
      product: true,
      description: true,
      amount: true,
      currency: true,
      status: true,
      invoiceNumber: true,
      createdAt: true,
      paidAt: true,
      user: { select: { name: true, email: true } },
      company: { select: { name: true } },
    },
  });
  // Visible to the purchaser, to members of the company it was bought for, and to admins.
  if (!payment || (!viewer.isAdmin && payment.userId !== viewer.id && (!payment.companyId || payment.companyId !== viewer.company?.id))) notFound();
  // An invoice exists only for a completed payment: pending, failed or refunded attempts have none
  // (their row keeps a reserved invoice number, but no invoice is ever issued for it).
  if (payment.status !== "SUCCEEDED") notFound();

  const date = (d: Date) => f.date(d, { year: "numeric", month: "long", day: "numeric" });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <Link href="/settings/billing" className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg">
          <ArrowLeft className="size-4" /> {t("billing.title")}
        </Link>
        <PrintButton />
      </div>
      <Card className="p-8 sm:p-10 print:border-0 print:shadow-none">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <Logo />
          <div className="text-end">
            <h1 className="font-display text-2xl font-semibold">{t("billing.invoiceTitle", { n: payment.invoiceNumber })}</h1>
            <Badge tone={payment.status === "SUCCEEDED" ? "mint" : payment.status === "FAILED" ? "danger" : "neutral"} className="mt-2">
              {t(`billing.statusLabel.${payment.status}`)}
            </Badge>
          </div>
        </div>
        <div className="mt-10 grid gap-6 text-sm sm:grid-cols-2">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-fg-subtle">{t("billing.billedTo")}</div>
            <div className="mt-1.5 font-medium">{payment.company?.name ?? payment.user.name}</div>
            {payment.company && <div className="text-fg-muted">{payment.user.name}</div>}
            <div className="text-fg-muted">
              <bdi>{payment.user.email}</bdi>
            </div>
          </div>
          <div className="sm:text-end">
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-fg-subtle">{t("billing.issued")}</div>
            <div className="mt-1.5 font-medium">{date(payment.paidAt ?? payment.createdAt)}</div>
          </div>
        </div>
        <table className="mt-10 w-full text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-fg-muted">
              <th className="py-2.5 text-start font-medium">{t("billing.item")}</th>
              <th className="py-2.5 text-end font-medium">{t("billing.amount")}</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border">
              <td className="py-4">
                <div className="font-medium">
                  {t(`premium.products.${payment.product}.name`)}
                  {featuredJobDays(payment) && <span className="font-normal text-fg-muted"> · {t("jobs.planDays", { n: featuredJobDays(payment)! })}</span>}
                </div>
                <div className="text-xs text-fg-muted">{t(`premium.products.${payment.product}.tagline`)}</div>
              </td>
              <td className="py-4 text-end tabular-nums">{f.money(payment.amount, payment.currency)}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td className="pt-4 font-semibold">{t("billing.total")}</td>
              <td className="pt-4 text-end font-display text-xl font-semibold tabular-nums">{f.money(payment.amount, payment.currency)}</td>
            </tr>
          </tfoot>
        </table>
        {payment.status === "SUCCEEDED" && payment.paidAt && (
          <p className="mt-10 text-xs text-fg-subtle">{t("billing.paidVia")}</p>
        )}
      </Card>
    </div>
  );
}
