// Generates the abstract artwork used for seeded company covers and
// "Life at the Company" galleries. Deterministic, dependency-free, and small,
// so demo data never relies on third-party image hosts.
//
//   node scripts/generate-media.mjs

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const OUT = join(process.cwd(), "public", "media");
mkdirSync(OUT, { recursive: true });

function rng(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PALETTES = [
  ["#5b46e5", "#2fa7d6", "#4fd1a5"],
  ["#1f2a6b", "#6a4cf0", "#f0a032"],
  ["#0e7c86", "#4fd1a5", "#e9f7f2"],
  ["#8a2be2", "#ff7a59", "#ffd166"],
  ["#14213d", "#2fa7d6", "#e5e5e5"],
  ["#3a0ca3", "#f72585", "#4cc9f0"],
  ["#264653", "#2a9d8f", "#e9c46a"],
  ["#1d3557", "#457b9d", "#f1faee"],
];

function art(seed, w, h, kind) {
  const r = rng(seed);
  const [a, b, c] = PALETTES[seed % PALETTES.length];
  const shapes = [];
  const n = kind === "cover" ? 7 : 11;
  for (let i = 0; i < n; i++) {
    const x = Math.round(r() * w);
    const y = Math.round(r() * h);
    const s = Math.round((0.12 + r() * 0.35) * Math.min(w, h));
    const fill = [a, b, c][i % 3];
    const op = (0.18 + r() * 0.5).toFixed(2);
    if (r() > 0.5) {
      shapes.push(`<circle cx="${x}" cy="${y}" r="${s / 2}" fill="${fill}" opacity="${op}"/>`);
    } else {
      const rot = Math.round(r() * 90);
      shapes.push(`<rect x="${x - s / 2}" y="${y - s / 2}" width="${s}" height="${Math.round(s * (0.6 + r() * 0.6))}" rx="${Math.round(s * 0.18)}" fill="${fill}" opacity="${op}" transform="rotate(${rot} ${x} ${y})"/>`);
    }
  }
  // Network motif: a few connected nodes.
  const nodes = Array.from({ length: 6 }, () => [Math.round(r() * w), Math.round(r() * h)]);
  const lines = nodes.slice(1).map(([x, y], i) => `<line x1="${nodes[i][0]}" y1="${nodes[i][1]}" x2="${x}" y2="${y}" stroke="#ffffff" stroke-opacity="0.35" stroke-width="2"/>`);
  const dots = nodes.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="6" fill="#ffffff" fill-opacity="0.85"/>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>
<filter id="blur"><feGaussianBlur stdDeviation="${kind === "cover" ? 40 : 18}"/></filter></defs>
<rect width="${w}" height="${h}" fill="url(#g)"/>
<g filter="url(#blur)">${shapes.join("")}</g>
${lines.join("")}${dots.join("")}
</svg>`;
}

for (let i = 0; i < 16; i++) writeFileSync(join(OUT, `cover-${i + 1}.svg`), art(1000 + i, 1600, 480, "cover"));
for (let i = 0; i < 24; i++) writeFileSync(join(OUT, `life-${i + 1}.svg`), art(2000 + i, 1200, 800, "life"));
for (let i = 0; i < 12; i++) writeFileSync(join(OUT, `project-${i + 1}.svg`), art(3000 + i, 1200, 750, "life"));
console.log(`Generated media in ${OUT}`);
