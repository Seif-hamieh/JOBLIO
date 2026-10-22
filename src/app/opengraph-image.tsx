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
          background: "radial-gradient(circle at 85% 0%, #2a1f6b 0%, #0a0a0c 55%)",
          color: "white",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <svg width="96" height="96" viewBox="0 0 40 40">
            <path d="M27 6v17a8.5 8.5 0 0 1-17 0v-4" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
            <path d="M10 9.5 4.8 17.8h10.4Z" fill="#8f7dff" stroke="#8f7dff" strokeWidth="1.6" strokeLinejoin="round" />
          </svg>
          <div style={{ fontSize: 64, fontWeight: 800, letterSpacing: -3 }}>joblio</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 72, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2 }}>Your Career. Your Network. Your Future.</div>
          <div style={{ fontSize: 32, color: "rgba(255,255,255,0.78)" }}>Jobs, people and companies — with matching you can understand. No AI.</div>
        </div>
        <div style={{ display: "flex", fontSize: 26, color: "#8f7dff" }}>getjoblio.app</div>
      </div>
    ),
    size,
  );
}
