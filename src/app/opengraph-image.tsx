import { ImageResponse } from "next/og";

// Link preview image for social networks and messaging apps (og:image / twitter:image).
export const alt = "JOBLIO — Your Career. Your Network. Your Future.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "linear-gradient(135deg, #1b1840 0%, #2a2470 55%, #1f6f8f 100%)",
          color: "white",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <svg width="96" height="96" viewBox="0 0 32 32">
            <defs>
              <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#5b46e5" />
                <stop offset="1" stopColor="#2fa7d6" />
              </linearGradient>
            </defs>
            <rect width="32" height="32" rx="9.5" fill="url(#g)" />
            <path d="M19.4 9.2v8.9a5.3 5.3 0 0 1-10.6 0" stroke="#fff" strokeWidth="3.1" strokeLinecap="round" fill="none" />
            <circle cx="19.4" cy="9.2" r="2.7" fill="#fff" />
            <circle cx="24.6" cy="22.6" r="2" fill="#4fd1a5" />
          </svg>
          <div style={{ fontSize: 64, fontWeight: 700, letterSpacing: -2 }}>joblio</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 72, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2 }}>Your Career. Your Network. Your Future.</div>
          <div style={{ fontSize: 32, color: "rgba(255,255,255,0.75)" }}>Jobs, people and companies — with matching you can understand. No AI.</div>
        </div>
        <div style={{ display: "flex", fontSize: 26, color: "#4fd1a5" }}>getjoblio.app</div>
      </div>
    ),
    size,
  );
}
