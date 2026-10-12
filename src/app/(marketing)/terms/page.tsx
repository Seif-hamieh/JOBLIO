import { StaticPageView, staticPageMetadata } from "@/components/marketing/static-page";

export const generateMetadata = staticPageMetadata("terms");

export default function Page() {
  return <StaticPageView id="terms" />;
}
