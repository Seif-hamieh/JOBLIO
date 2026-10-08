// Deterministic layout for the hero network (shared by the 3D scene and the
// lightweight SVG fallback so both tell the same story).

export type NodeKind = "person" | "company" | "job" | "skill";

export type NetNode = { x: number; y: number; z: number; kind: NodeKind; size: number };

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const KIND_SEQUENCE: NodeKind[] = ["person", "skill", "job", "person", "skill", "company", "person", "skill", "job", "skill"];
const KIND_SIZE: Record<NodeKind, number> = { person: 0.085, company: 0.13, job: 0.1, skill: 0.05 };

export function buildNetwork(count = 72, radius = 2.7, seed = 7) {
  const rand = mulberry32(seed);
  const nodes: NetNode[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const theta = golden * i;
    const jitter = 0.78 + rand() * 0.34;
    const kind = KIND_SEQUENCE[i % KIND_SEQUENCE.length]!;
    nodes.push({
      x: Math.cos(theta) * r * radius * jitter,
      y: y * radius * 0.82 * jitter,
      z: Math.sin(theta) * r * radius * jitter,
      kind,
      size: KIND_SIZE[kind] * (0.8 + rand() * 0.5),
    });
  }
  // Connect every node to its two nearest neighbours (deduplicated).
  const edges: [number, number][] = [];
  const seen = new Set<string>();
  nodes.forEach((a, i) => {
    const nearest = nodes
      .map((b, j) => ({ j, d: (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2 }))
      .filter((n) => n.j !== i)
      .sort((p, q) => p.d - q.d)
      .slice(0, a.kind === "company" ? 4 : 2);
    for (const { j } of nearest) {
      const key = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (!seen.has(key)) {
        seen.add(key);
        edges.push([i, j]);
      }
    }
  });
  return { nodes, edges };
}
