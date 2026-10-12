import { StaticPageView, staticPageMetadata } from "@/components/marketing/static-page";

export const generateMetadata = staticPageMetadata("about");

export default function Page() {
  return <StaticPageView id="about" />;
}
