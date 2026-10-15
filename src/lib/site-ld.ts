// schema.org Organization + WebSite for the home page (brand info and the sitelinks
// search box). Serialise with jsonLdScript from "@/lib/job-posting-ld".

export function organizationJsonLd(siteUrl: string, locale: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "JOBLIO",
    url: siteUrl,
    logo: `${siteUrl}/icon-512.png`,
    description:
      locale === "ar"
        ? "شبكة مهنية ومنصة توظيف بلا ذكاء اصطناعي، بمطابقة شفافة قائمة على قواعد."
        : "A professional network and hiring platform with transparent, rule-based matching — no AI.",
  };
}

export function websiteJsonLd(siteUrl: string) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "JOBLIO",
    url: siteUrl,
    potentialAction: {
      "@type": "SearchAction",
      target: `${siteUrl}/jobs?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
}
