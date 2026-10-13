import type { MetadataRoute } from "next";

// Web app manifest (install to home screen, theme colour on Android).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "JOBLIO — Your Career. Your Network. Your Future.",
    short_name: "JOBLIO",
    description: "Jobs, people and companies with transparent, rule-based matching. No AI.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f7f7fc",
    theme_color: "#5b46e5",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
      { src: "/favicon.ico", sizes: "48x48", type: "image/x-icon" },
    ],
  };
}
