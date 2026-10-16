import { getViewer } from "@/server/session";
import { getCounts } from "@/server/services/counts";
import { AppShell } from "@/components/layout/app-shell";
import { CompactFooter, SiteFooter } from "@/components/layout/site-footer";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  const counts = viewer ? await getCounts(viewer.id) : null;
  return (
    <AppShell
      viewer={
        viewer && {
          id: viewer.id,
          name: viewer.name,
          image: viewer.image,
          username: viewer.username,
          headline: viewer.headline,
          company: viewer.company && { slug: viewer.company.slug, name: viewer.company.name },
          boosted: viewer.boosted,
          isAdmin: viewer.isAdmin,
        }
      }
      counts={counts}
      footer={viewer ? <CompactFooter /> : <SiteFooter />}
    >
      {children}
    </AppShell>
  );
}
