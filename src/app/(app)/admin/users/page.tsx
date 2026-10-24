import Link from "next/link";
import { Ban, Search, Users } from "lucide-react";
import { getI18n } from "@/i18n/server";
import { requireAdmin } from "@/server/session";
import { db, type Prisma } from "@/server/db";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Card, EmptyState, Pagination } from "@/components/ui/misc";
import { UserActions } from "@/components/admin/user-actions";

const PAGE_SIZE = 50;

export async function generateMetadata() {
  return { title: (await getI18n()).t("admin.users") };
}

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [viewer, { t, f }, sp] = await Promise.all([requireAdmin(), getI18n(), searchParams]);
  const q = first(sp.q)?.trim().slice(0, 100) || undefined;
  const pageNum = Number(first(sp.page));
  const page = Number.isInteger(pageNum) && pageNum > 0 ? pageNum : 1;
  const bannedOnly = first(sp.filter) === "banned";

  const where: Prisma.UserWhereInput = {
    ...(q && { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }, { username: { contains: q, mode: "insensitive" } }] }),
    ...(bannedOnly && { bannedAt: { not: null } }),
  };
  const [users, total] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: { id: true, name: true, email: true, username: true, image: true, platformRole: true, intent: true, createdAt: true, bannedAt: true, bannedReason: true },
    }),
    db.user.count({ where }),
  ]);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const href = (p: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (bannedOnly) params.set("filter", "banned");
    if (p > 1) params.set("page", String(p));
    const s = params.toString();
    return s ? `/admin/users?${s}` : "/admin/users";
  };

  const th = "px-4 py-2.5 text-start text-xs font-semibold text-fg-muted";
  const td = "px-4 py-3 align-middle";

  return (
    <div className="space-y-5">
      <form method="get" role="search" className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" />
          <Input name="q" type="search" defaultValue={q} placeholder={t("admin.userTable.search")} aria-label={t("admin.userTable.search")} maxLength={100} className="ps-10" />
        </div>
        {bannedOnly && <input type="hidden" name="filter" value="banned" />}
        <Button type="submit" variant="outline" className="h-11">
          {t("admin.search")}
        </Button>
      </form>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Link href={q ? `/admin/users?q=${encodeURIComponent(q)}` : "/admin/users"} className={buttonClasses({ variant: bannedOnly ? "ghost" : "outline", size: "xs", pill: true })}>
          {t("admin.userTable.everyone")}
        </Link>
        <Link href={`/admin/users?filter=banned${q ? `&q=${encodeURIComponent(q)}` : ""}`} className={buttonClasses({ variant: bannedOnly ? "outline" : "ghost", size: "xs", pill: true })}>
          <Ban className="size-3.5" /> {t("admin.userTable.bannedOnly")}
        </Link>
        <span className="ms-auto text-fg-muted">{t("admin.results", { n: total })}</span>
      </div>

      {users.length === 0 ? (
        <EmptyState icon={<Users />} title={t("admin.noData")} />
      ) : (
        <Card className="overflow-hidden">
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-surface-2">
                <tr className="border-b border-border">
                  <th scope="col" className={th}>{t("admin.cols.name")}</th>
                  <th scope="col" className={th}>{t("admin.cols.email")}</th>
                  <th scope="col" className={th}>{t("admin.cols.role")}</th>
                  <th scope="col" className={th}>{t("admin.userTable.intent")}</th>
                  <th scope="col" className={th}>{t("admin.cols.joined")}</th>
                  <th scope="col" className={th}><span className="sr-only">{t("admin.actions")}</span></th>
                </tr>
              </thead>
              <tbody className="[&>tr]:transition-colors [&>tr:hover]:bg-surface-2/60">
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-border last:border-0">
                    <td className={td}>
                      <div className="flex items-center gap-3">
                        <Avatar name={u.name} src={u.image} size="sm" />
                        <span className="font-medium">{u.name}</span>
                      </div>
                    </td>
                    <td className={`${td} text-fg-muted`} dir="ltr">{u.email}</td>
                    <td className={td}>
                      <div className="flex flex-wrap gap-1">
                        <Badge tone={u.platformRole === "ADMIN" ? "brand" : "neutral"} size="xs">{u.platformRole}</Badge>
                        {u.bannedAt && (
                          <Badge tone="danger" size="xs" title={u.bannedReason ?? undefined}>
                            {t("admin.userTable.banned")}
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className={`${td} text-fg-muted`}>{t(`admin.intent.${u.intent}`)}</td>
                    <td className={`${td} whitespace-nowrap text-fg-muted`}>{f.date(u.createdAt, { day: "numeric", month: "short", year: "numeric" })}</td>
                    <td className={td}>
                      <UserActions isSelf={u.id === viewer.id} user={{ id: u.id, name: u.name, username: u.username, isAdmin: u.platformRole === "ADMIN", banned: !!u.bannedAt }} />
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
