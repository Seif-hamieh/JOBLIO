// YouTube and Vimeo links for company "Life at" videos. Only these two hosts
// are accepted, and they are embedded through their privacy-friendly players
// (also the only frame sources allowed by the CSP in next.config.ts).

export type VideoLink = {
  provider: "youtube" | "vimeo";
  id: string;
  /** Canonical watch URL, the value stored in the database. */
  url: string;
  embedUrl: string;
  /** YouTube has a public still image; Vimeo needs its API, so none. */
  thumbnailUrl: string | null;
};

const YT_ID = /^[\w-]{11}$/;

export function parseVideoUrl(input: string | null | undefined): VideoLink | null {
  let u: URL;
  try {
    u = new URL(String(input ?? "").trim());
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  const host = u.hostname.replace(/^(www\.|m\.)/, "");

  let yt: string | null = null;
  if (host === "youtu.be") yt = u.pathname.slice(1).split("/")[0] ?? null;
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (u.pathname === "/watch") yt = u.searchParams.get("v");
    else {
      const m = u.pathname.match(/^\/(?:embed|shorts|live)\/([^/?#]+)/);
      yt = m?.[1] ?? null;
    }
  }
  if (yt && YT_ID.test(yt)) {
    return {
      provider: "youtube",
      id: yt,
      url: `https://www.youtube.com/watch?v=${yt}`,
      embedUrl: `https://www.youtube-nocookie.com/embed/${yt}?autoplay=1&rel=0`,
      thumbnailUrl: `https://i.ytimg.com/vi/${yt}/hqdefault.jpg`,
    };
  }

  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const m = u.pathname.match(/(?:^|\/)(\d{6,12})(?:\/|$)/);
    if (m) {
      return {
        provider: "vimeo",
        id: m[1]!,
        url: `https://vimeo.com/${m[1]}`,
        embedUrl: `https://player.vimeo.com/video/${m[1]}?autoplay=1&dnt=1`,
        thumbnailUrl: null,
      };
    }
  }
  return null;
}
