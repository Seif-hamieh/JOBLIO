import type { MetadataRoute } from "next";

// Web app manifest: lets Android, desktop Chrome/Edge (and iOS "Add to Home Screen")
// install JOBLIO as an app. A manifest has a single `lang`; the app name is the same
// in both languages and the UI itself still follows the reader's language.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "JOBLIO",
    short_name: "JOBLIO",
    description: "Your Career. Your Network. Your Future. Jobs, people and companies with transparent, rule-based matching — no AI.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#ffffff",
    // Matches the light-mode title bar; the per-scheme theme-color meta tags (layout viewport) switch it to #14131f in dark mode.
    theme_color: "#f7f7fc",
    lang: "en",
    dir: "auto",
    categories: ["business", "productivity", "social"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
screenshots: [
  {
    src: "/screenshots/home-desktop.png",
    sizes: "1920x1080",
    type: "image/png",
    form_factor: "wide",
  },
  {
    src: "/screenshots/home-mobile.png",
    sizes: "390x844",
    type: "image/png",
    form_factor: "narrow",
  },
  {
    src: "/screenshots/jobs-mobile.png",
    sizes: "390x844",
    type: "image/png",
    form_factor: "narrow",
  },
],
    shortcuts: [
      { name: "Jobs", short_name: "Jobs", url: "/jobs", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
      { name: "Messages", short_name: "Messages", url: "/messages", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
      { name: "Profile", short_name: "Profile", url: "/profile", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
