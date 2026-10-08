"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, m } from "motion/react";
import { SKILL_RANK, type SkillLevel } from "@/lib/constants";
import { useI18n } from "@/i18n/client";
import { categoryName } from "@/i18n/translate";
import { hashString } from "@/lib/utils";

export type ConstellationSkill = { id: string; name: string; category: string; level: SkillLevel; endorsements: number; isTop?: boolean };

const HUES = [281, 222, 166, 62, 330, 195, 25, 120];

/**
 * Interactive skill map: categories orbit the centre, skills cluster around
 * their category, node size reflects level. SVG + springs, no WebGL needed.
 */
export function SkillConstellation({ skills, name }: { skills: ConstellationSkill[]; name: string }) {
  const { t } = useI18n();
  const [active, setActive] = useState<string | null>(null);
  const layout = useMemo(() => {
    const round = (n: number) => Math.round(n * 10) / 10;
    // Group skills by category, largest groups first.
    const groups = [...new Set(skills.map((s) => s.category))]
      .map((c) => ({ name: c, skills: skills.filter((s) => s.category === c) }))
      .sort((a, b) => b.skills.length - a.skills.length);

    // Pack each group's skills on concentric rings sized to fit their labels.
    const packed = groups.map((g) => {
      const offsets: { dx: number; dy: number }[] = [];
      let ring = 0;
      let placed = 0;
      while (placed < g.skills.length) {
        const radius = 58 + ring * 46;
        const capacity = Math.max(4, Math.floor((2 * Math.PI * radius) / 62));
        const count = Math.min(capacity, g.skills.length - placed);
        for (let k = 0; k < count; k++) {
          const a = (k / count) * Math.PI * 2 + ring * 0.5 + 0.3;
          offsets.push({ dx: Math.cos(a) * radius, dy: Math.sin(a) * radius });
        }
        placed += count;
        ring++;
      }
      return { ...g, offsets, radius: 58 + (ring - 1) * 46 };
    });

    // Place groups around the centre, far enough out that clusters don't overlap.
    const catNodes = packed.map((g, i) => {
      const start = packed.length <= 2 ? Math.PI : -Math.PI / 2;
      const a = (i / packed.length) * Math.PI * 2 + start;
      const d = packed.length === 1 ? 0 : g.radius + 70;
      return { name: g.name, x: round(Math.cos(a) * d), y: round(Math.sin(a) * d * 0.85), hue: HUES[hashString(g.name) % HUES.length]!, group: g };
    });

    const nodes = catNodes.flatMap((cat) =>
      cat.group.skills.map((s, idx) => ({
        ...s,
        x: round(cat.x + cat.group.offsets[idx]!.dx),
        y: round(cat.y + cat.group.offsets[idx]!.dy),
        r: 5 + SKILL_RANK[s.level] * 2.6,
        hue: cat.hue,
        cat,
      })),
    );

    // Fit the viewBox to the content (with room for labels).
    const xs = [0, ...nodes.map((n) => n.x), ...catNodes.map((c) => c.x)];
    const ys = [0, ...nodes.map((n) => n.y), ...catNodes.map((c) => c.y)];
    const minX = Math.min(...xs) - 60;
    const maxX = Math.max(...xs) + 60;
    const minY = Math.min(...ys) - 30;
    const maxY = Math.max(...ys) + 36;
    return { box: `${round(minX)} ${round(minY)} ${round(maxX - minX)} ${round(maxY - minY)}`, cx: 0, cy: 0, catNodes, nodes };
  }, [skills]);

  const hovered = layout.nodes.find((n) => n.id === active);
  if (skills.length === 0) return null;

  return (
    <div className="relative">
      <svg viewBox={layout.box} className="max-h-[460px] w-full" role="img" aria-label={t("skills.mapFor", { name })}>
        <defs>
          <radialGradient id="sc-core">
            <stop offset="0" stopColor="var(--brand)" stopOpacity="0.35" />
            <stop offset="1" stopColor="var(--brand)" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx={layout.cx} cy={layout.cy} r={80} fill="url(#sc-core)" />
        {layout.catNodes.map((c, i) => (
          <m.line
            key={c.name}
            x1={layout.cx}
            y1={layout.cy}
            x2={c.x}
            y2={c.y}
            stroke={`oklch(0.7 0.12 ${c.hue})`}
            strokeOpacity={0.35}
            strokeWidth={1.5}
            initial={{ pathLength: 0 }}
            whileInView={{ pathLength: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: i * 0.08 }}
          />
        ))}
        {layout.nodes.map((n) => (
          <line
            key={`l-${n.id}`}
            x1={n.cat.x}
            y1={n.cat.y}
            x2={n.x}
            y2={n.y}
            stroke={`oklch(0.7 0.12 ${n.hue})`}
            strokeOpacity={active && active !== n.id ? 0.08 : 0.3}
            strokeWidth={1}
          />
        ))}
        <circle cx={layout.cx} cy={layout.cy} r={9} fill="var(--brand)" />
        {layout.catNodes.map((c) => (
          <g key={`c-${c.name}`}>
            <circle cx={c.x} cy={c.y} r={4} fill={`oklch(0.65 0.14 ${c.hue})`} />
            <text
              x={c.x}
              y={c.y + 3.5}
              dx={8}
              textAnchor="start"
              paintOrder="stroke"
              stroke="var(--surface)"
              strokeWidth={4}
              className="fill-[var(--fg-muted)] text-[9.5px] font-semibold uppercase tracking-wider"
            >
              {categoryName(t, c.name)}
            </text>
          </g>
        ))}
        {layout.nodes.map((n, i) => (
          <m.g
            key={n.id}
            initial={{ opacity: 0, scale: 0 }}
            whileInView={{ opacity: active && active !== n.id ? 0.35 : 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.3 + i * 0.03 }}
            style={{ transformOrigin: `${n.x}px ${n.y}px` }}
            onMouseEnter={() => setActive(n.id)}
            onMouseLeave={() => setActive(null)}
            onFocus={() => setActive(n.id)}
            onBlur={() => setActive(null)}
            tabIndex={0}
            className="cursor-pointer outline-none"
            role="button"
            aria-label={`${n.name}, ${t(`enums.skillLevel.${n.level}`)}, ${t("skills.endorsements", { n: n.endorsements })}`}
          >
            <circle cx={n.x} cy={n.y} r={n.r + 5} fill={`oklch(0.7 0.14 ${n.hue})`} opacity={0.15} />
            <circle cx={n.x} cy={n.y} r={n.r} fill={`oklch(0.66 0.15 ${n.hue})`} stroke="var(--surface)" strokeWidth={2} />
            <text x={n.x} y={n.y + n.r + 12} textAnchor="middle" paintOrder="stroke" stroke="var(--surface)" strokeWidth={3} className="fill-[var(--fg)] text-[10.5px] font-medium">
              {n.name.length > 16 ? `${n.name.slice(0, 15)}…` : n.name}
            </text>
          </m.g>
        ))}
      </svg>
      <AnimatePresence>
        {hovered && (
          <m.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 rounded-xl border border-border bg-surface px-3 py-2 text-center shadow-float"
          >
            <div className="text-sm font-semibold">{hovered.name}</div>
            <div className="text-xs text-fg-muted">
              {t(`enums.skillLevel.${hovered.level}`)} · {t("skills.endorsements", { n: hovered.endorsements })}
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
