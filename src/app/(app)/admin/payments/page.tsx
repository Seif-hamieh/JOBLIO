import Link from "next/link";
import { CircleCheck, CircleX, Clock, DollarSign, Receipt, Search } from "lucide-react";
import { getI18n } from "@/i18n/server";
import { requireAdmin } from "@/server/session";
import { db, type Prisma } from "@/server/db";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { Card, EmptyState, Pagination, Stat } from "@/components/ui/misc";

const PAGE_SIZE = 50;
const STATUSES = [
  { value: "SUCCEEDED", key: "admin.filters.succeeded" },
  { value: "PENDING", key: "admin.filters.pending" },
  { value: "FAILED", key: "admin.filters.failed" },
] as const;
const PRODUCTS = ["FEATURED_JOB", "URGENT_HIRE", "PROFILE_BOOST", "PRIORITY_APPLICATION", "JOB_SEEKER_PRO", "COMPANY_PREMIUM"] as const;
const STATUS_TONE: Record<string, BadgeTone> = { SUCCEEDED: "mint", PENDING: "ember", FAILED: "danger", REFUNDED: "neutral" };
const PRODUCT_TONE: Partial<Record<string, BadgeTone>> = {
  FEATURED_JOB: "brand",
  URGENT_HIRE: "danger",
  PROFILE_BOOST: "ember",
  PRIORITY_APPLICATION: "mint",
  JOB_SEEKER_PRO: "aurora",
  COMPANY_PREMIUM: "solid",
};

export async function generateMetadata() {
  return { title: (await getI18n()).t("admin.payments") };
}

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function AdminPaymentsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [, { t, f }, sp] = await Promise.all([requireAdmin(), getI18n(), searchParams]);
  const q = first(sp.q)?.trim().slice(0, 100) || undefined;
  const status = STATUSES.find((s) => s.value === first(sp.status))?.value;
  const product = PRODUCTS.find((p) => p === first(sp.product));
  const pageNum = Number(first(sp.page));
  const page = Number.isInteger(pageNum) && pageNum > 0 ? pageNum : 1;

  const where: Prisma.PaymentWhereInput = {
    ...(q && { OR: [{ user: { email: { contains: q, mode: "insensitive" } } }, { invoiceNumber: { contains: q, mode: "insensitive" } }] }),
    ...(status && { status }),
    ...(product && { product }),
  };
  const [payments, total, revenue, succeeded, pending, failed] = await Promise.all([
    db.payment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        product: true,
        amount: true,
        currency: true,
        status: true,
        invoiceNumber: true,
        createdAt: true,
        paidAt: true,
        user: { select: { name: true, email: true, username: true } },
      },
    }),
    db.payment.count({ where }),
    // Platform-wide totals (not affected by the filters). All products are priced in USD.
    db.payment.aggregate({ where: { status: "SUCCEEDED" }, _sum: { amount: true } }),
    db.payment.count({ where: { status: "SUCCEEDED" } }),
    db.payment.count({ where: { status: "PENDING" } }),
    db.payment.count({ where: { status: "FAILED" } }),
  ]);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const href = (p: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (status) params.set("status", status);
    if (product) params.set("product", product);
    if (p > 1) params.set("page", String(p));
    const s = params.toString();
    return s ? `/admin/payments?${s}` : "/admin/payments";
  };

  const th = "px-4 py-2.5 text-start text-xs font-semibold text-fg-muted";
  const td = "px-4 py-3 align-middle";
  const link = buttonClasses({ variant: "ghost", size: "xs" });

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat label={t("admin.paymentStats.revenue")} value={f.money(revenue._sum.amount ?? 0, "usd")} icon={<DollarSign />} />
        <Stat label={t("admin.paymentStats.succeeded")} value={f.number(succeeded)} icon={<CircleCheck />} />
        <Stat label={t("admin.paymentStats.pending")} value={f.number(pending)} icon={<Clock />} />
        <Stat label={t("admin.paymentStats.failed")} value={f.number(failed)} icon={<CircleX />} />
      </div>

      <form method="get" role="search" className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" />
          <Input name="q" type="search" defaultValue={q} placeholder={t("admin.paymentsTable.search")} aria-label={t("admin.paymentsTable.search")} maxLength={100} className="ps-10" />
        </div>
        <div className="sm:w-40">
          <Select name="status" defaultValue={status ?? ""} aria-label={t("admin.paymentsTable.status")}>
            <option value="">{t("admin.filters.all")}</option>
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {t(s.key)}
              </option>
            ))}
          </Select>
        </div>
        <div className="sm:w-52">
          <Select name="product" defaultValue={product ?? ""} aria-label={t("admin.paymentsTable.product")}>
            <option value="">{t("admin.filters.all")}</option>
            {PRODUCTS.map((p) => (
              <option key={p} value={p}>
                {t(`premium.products.${p}.name`)}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit" variant="outline" className="h-11">
          {t("admin.search")}
        </Button>
      </form>
      <p className="text-sm text-fg-muted">{t("admin.results", { n: total })}</p>

      {payments.length === 0 ? (
        <EmptyState icon={<Receipt />} title={t("admin.noData")} />
      ) : (
        <Card className="overflow-hidden">
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[960px] text-sm">
              <thead className="bg-surface-2">
                <tr className="border-b border-border">
                  <th scope="col" className={th}>{t("admin.paymentsTable.user")}</th>
                  <th scope="col" className={th}>{t("admin.paymentsTable.product")}</th>
                  <th scope="col" className={th}>{t("admin.paymentsTable.amount")}</th>
                  <th scope="col" className={th}>{t("admin.paymentsTable.status")}</th>
                  <th scope="col" className={th}>{t("admin.paymentsTable.date")}</th>
                  <th scope="col" className={th}>{t("admin.paymentsTable.invoice")}</th>
                  <th scope="col" className={th}><span className="sr-only">{t("admin.actions")}</span></th>
                </tr>
              </thead>
              <tbody className="[&>tr]:transition-colors [&>tr:hover]:bg-surface-2/60">
                {payments.map((p) => (
                  <tr key={p.id} className="border-b border-border last:border-0">
                    <td className={td}>
                      <div className="font-medium">{p.user.name}</div>
                      <div className="text-xs text-fg-subtle" dir="ltr">{p.user.email}</div>
                    </td>
                    <td className={td}>
                      <Badge tone={PRODUCT_TONE[p.product] ?? "neutral"} size="xs">{t(`premium.products.${p.product}.name`)}</Badge>
                    </td>
                    <td className={`${td} whitespace-nowrap tabular-nums`} dir="ltr">{f.money(p.amount, p.currency)}</td>
                    <td className={td}>
                      <Badge tone={STATUS_TONE[p.status] ?? "neutral"} size="xs">{t(`billing.statusLabel.${p.status}`)}</Badge>
                    </td>
                    <td className={`${td} whitespace-nowrap text-fg-muted`}>{f.date(p.paidAt ?? p.createdAt, { day: "numeric", month: "short", year: "numeric" })}</td>
                    <td className={`${td} whitespace-nowrap font-mono text-xs text-fg-muted`} dir="ltr">{p.invoiceNumber}</td>
                    <td className={td}>
                      <div className="flex items-center justify-end gap-1.5">
                        <Link href={p.user.username ? `/in/${p.user.username}` : `/admin/users?q=${encodeURIComponent(p.user.email)}`} className={link}>
                          {t("admin.paymentsTable.viewUser")}
                        </Link>
                        {p.status === "SUCCEEDED" && (
                          <Link href={`/settings/billing/${encodeURIComponent(p.invoiceNumber)}`} className={link}>
                            {t("admin.paymentsTable.viewInvoice")}
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Pagination page={page} pageCount={pageCount} href={href} />
    </div>
  );
}
