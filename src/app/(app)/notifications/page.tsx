import { getI18n, pageTitle } from "@/i18n/server";
import { renderNotification } from "@/server/services/notifications";
import Link from "next/link";
import { Settings2 } from "lucide-react";
import { requireViewer } from "@/server/session";
import { db } from "@/server/db";
import { NotificationList } from "@/components/notifications/notification-list";
import { PageHeader } from "@/components/ui/misc";
import { buttonClasses } from "@/components/ui/button";

export const generateMetadata = pageTitle("notifications.title");

export default async function NotificationsPage() {
  const [viewer, { t }] = await Promise.all([requireViewer(), getI18n()]);
  const rows = await db.notification.findMany({
    where: { userId: viewer.id },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { id: true, type: true, title: true, body: true, titleKey: true, bodyKey: true, vars: true, href: true, readAt: true, createdAt: true, actor: { select: { name: true, image: true } } },
  });
  const items = rows.map(({ titleKey: _k, bodyKey: _b, vars: _v, ...n }) => ({ ...n, ...renderNotification(t, { ...n, titleKey: _k, bodyKey: _b, vars: _v }) }));
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title={t("notifications.title")}
        description={t("notifications.sub")}
        actions={
          <Link href="/settings#notifications" className={buttonClasses({ variant: "outline", size: "sm", pill: true })}>
            <Settings2 /> {t("notifications.preferences")}
          </Link>
        }
      />
      <NotificationList items={items} />
    </div>
  );
}
