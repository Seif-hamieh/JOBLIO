import { StaticPageView, staticPageMetadata } from "@/components/marketing/static-page";

export const generateMetadata = staticPageMetadata("privacy");

export default function Page() {
  return <StaticPageView id="privacy" />;
}
