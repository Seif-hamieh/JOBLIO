import { CreditCard, Search, TriangleAlert } from "lucide-react";
import { getI18n } from "@/i18n/server";
import { requireAdmin } from "@/server/session";
import { db, type Prisma } from "@/server/db";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { Card, EmptyState, Pagination } from "@/components/ui/misc";
import { SubscriptionActions } from "@/components/admin/subscription-actions";

const PAGE_SIZE = 50;
const STATUSES = [
  { value: "ACTIVE", key: "admin.filters.active" },
  { value: "CANCELED", key: "admin.filters.canceled" },
  { value: "PAST_DUE", key: "admin.filters.pastDue" },
  { value: "TRIALING", key: "admin.filters.trialing" },
] as const;
const STATUS_TONE: Record<string, BadgeTone> = { ACTIVE: "mint", TRIALING: "brand", PAST_DUE: "danger", CANCELED: "neutral", INCOMPLETE: "outline" };
const PRODUCT_TONE: Partial<Record<string, BadgeTone>> = { JOB_SEEKER_PRO: "aurora", COMPANY_PREMIUM: "brand", RECRUITER_PRO: "ember" };

export async function generateMetadata() {
  return { title: (await getI18n()).t("admin.subscriptions") };
}

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function AdminSubscriptionsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [, { t, f }, sp] = await Promise.all([requireAdmin(), getI18n(), searchParams]);
  const q = first(sp.q)?.trim().slice(0, 100) || undefined;
  const status = STATUSES.find((s) => s.value === first(sp.status))?.value;
  const pageNum = Number(first(sp.page));
  const page = Number.isInteger(pageNum) && pageNum > 0 ? pageNum : 1;

  const where: Prisma.SubscriptionWhereInput = {
    ...(q && { OR: [{ user: { email: { contains: q, mode: "insensitive" } } }, { company: { name: { contains: q, mode: "insensitive" } } }] }),
    ...(status && { status }),
  };
  const [subs, total] = await Promise.all([
    db.subscription.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        product: true,
        status: true,
        currentPeriodEnd: true,
        cancelAtPeriodEnd: true,
        createdAt: true,
        user: { select: { name: true, email: true, username: true } },
        company: { select: { name: true } },
      },
    }),
    db.subscription.count({ where }),
  ]);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const href = (p: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (status) params.set("status", status);
    if (p > 1) params.set("page", String(p));
    const s = params.toString();
    return s ? `/admin/subscriptions?${s}` : "/admin/subscriptions";
  };
  const date = (d: Date) => f.date(d, { day: "numeric", month: "short", year: "numeric" });

  const th = "px-4 py-3 text-start text-xs font-medium text-fg-subtle";
  const td = "px-4 py-3 align-middle";

  return (
    <div className="space-y-5">
      <form method="get" role="search" className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" />
          <Input name="q" type="search" defaultValue={q} placeholder={t("admin.subsTable.search")} aria-label={t("admin.subsTable.search")} maxLength={100} className="ps-10" />
        </div>
        <div className="sm:w-44">
          <Select name="status" defaultValue={status ?? ""} aria-label={t("admin.subsTable.status")}>
            <option value="">{t("admin.filters.all")}</option>
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {t(s.key)}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit" variant="outline" className="h-11">
          {t("admin.search")}
        </Button>
      </form>
      <p className="text-sm text-fg-muted">{t("admin.results", { n: total })}</p>

      {subs.length === 0 ? (
        <EmptyState icon={<CreditCard />} title={t("admin.noData")} />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th scope="col" className={th}>{t("admin.subsTable.subscriber")}</th>
                  <th scope="col" className={th}>{t("admin.subsTable.product")}</th>
                  <th scope="col" className={th}>{t("admin.subsTable.status")}</th>
                  <th scope="col" className={th}>{t("admin.subsTable.periodEnd")}</th>
                  <th scope="col" className={th}>{t("admin.subsTable.cancelAtEnd")}</th>
                  <th scope="col" className={th}>{t("admin.subsTable.created")}</th>
                  <th scope="col" className={th}><span className="sr-only">{t("admin.actions")}</span></th>
                </tr>
              </thead>
              <tbody>
                {subs.map((s) => (
                  <tr key={s.id} className="border-b border-border last:border-0">
                    <td className={td}>
                      <div className="min-w-0">
                        <div className="font-medium">{s.company?.name ?? s.user.name}</div>
                        <div className="text-xs text-fg-subtle" dir="ltr">
                          {s.company ? `${s.user.name} · ${s.user.email}` : s.user.email}
                        </div>
                      </div>
                    </td>
                    <td className={td}>
                      <Badge tone={PRODUCT_TONE[s.product] ?? "neutral"} size="xs">{t(`premium.products.${s.product}.name`)}</Badge>
                    </td>
                    <td className={td}>
                      <Badge tone={STATUS_TONE[s.status] ?? "neutral"} size="xs">{t(`billing.subStatus.${s.status}`)}</Badge>
                    </td>
                    <td className={`${td} whitespace-nowrap text-fg-muted`}>{date(s.currentPeriodEnd)}</td>
                    <td className={td}>
                      {s.cancelAtPeriodEnd ? <TriangleAlert className="size-4 text-ember-fg" aria-label={t("admin.subsTable.cancelAtEnd")} /> : <span className="text-fg-subtle">—</span>}
                    </td>
                    <td className={`${td} whitespace-nowrap text-fg-muted`}>{date(s.createdAt)}</td>
                    <td className={td}>
                      <SubscriptionActions
                        sub={{ id: s.id, canCancel: s.status === "ACTIVE" && !s.cancelAtPeriodEnd, username: s.user.username, email: s.user.email }}
                      />
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
