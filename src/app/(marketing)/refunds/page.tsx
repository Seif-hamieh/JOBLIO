import { StaticPageView, staticPageMetadata } from "@/components/marketing/static-page";

export const generateMetadata = staticPageMetadata("refunds");

export default function Page() {
  return <StaticPageView id="refunds" />;
}
