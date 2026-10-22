"use client";

import { useI18n } from "@/i18n/client";
import dynamic from "next/dynamic";
import { useTheme } from "@/components/theme";
import { m, useMotionValue, useSpring, useTransform } from "motion/react";
import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { BadgeCheck, Building2, Check, MapPin, Sparkles } from "lucide-react";
import { Avatar, CompanyLogo } from "@/components/ui/avatar";
import { OpenToWorkBadge } from "@/components/ui/badge";
import { MatchRing } from "@/components/match/match-ring";
import { cn } from "@/lib/utils";
import { buildNetwork } from "./network-data";
import type { ScenePalette } from "./network-scene";

const NetworkScene = dynamic(() => import("./network-scene"), { ssr: false });

const PALETTES: Record<"light" | "dark", ScenePalette> = {
  light: { person: "#6a4cf0", company: "#2f9fd3", job: "#1fb489", skill: "#f0a032", line: "#9b95cf", pulse: "#6a4cf0" },
  dark: { person: "#8f7dff", company: "#5cc3ee", job: "#4bd8a8", skill: "#f6b955", line: "#5f59a3", pulse: "#c0b6ff" },
};

/** Decides whether this device should get the WebGL scene or the SVG fallback. */
function useCan3D() {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const small = window.matchMedia("(max-width: 767px)").matches;
    const weak = (nav.hardwareConcurrency ?? 8) <= 2 || (nav.deviceMemory ?? 8) <= 2 || !!nav.connection?.saveData;
    let webgl = false;
    try {
      const c = document.createElement("canvas");
      webgl = !!(c.getContext("webgl2") || c.getContext("webgl"));
    } catch {
      webgl = false;
    }
    // Defer until the browser is idle so the 3D chunk never competes with first paint.
    const go = () => setOk(!reduced && !small && !weak && webgl);
    const ric = (window as Window & { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback;
    if (ric) ric(go);
    else setTimeout(go, 200);
  }, []);
  return ok;
}

/** True when the visitor asked the OS for less motion; follows changes to the setting live. */
function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return reduced;
}

/**
 * Pauses the SVG's SMIL animations (<animate>) when motion is reduced, the SVG is off screen, or the
 * tab is hidden. CSS rules (like the global reduced-motion one) don't reach SMIL, so it's done here.
 */
function usePausedSmil(svg: RefObject<SVGSVGElement | null>) {
  const reduced = useReducedMotion();
  const [inView, setInView] = useState(true);
  const [pageVisible, setPageVisible] = useState(true);
  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setInView(!!entry?.isIntersecting), { threshold: 0.01 });
    io.observe(el);
    const onVis = () => setPageVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVis);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [svg]);
  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    if (!reduced && inView && pageVisible) el.unpauseAnimations();
    else el.pauseAnimations();
  }, [svg, reduced, inView, pageVisible]);
}

function NetworkFallback({ className }: { className?: string }) {
  const svg = useRef<SVGSVGElement>(null);
  usePausedSmil(svg);
  const { nodes, edges } = useMemo(() => buildNetwork(46, 2.7, 11), []);
  // Rounded so server and browser math libraries produce identical markup.
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const project = (x: number, y: number, z: number) => ({ px: r2(200 + x * 62 + z * 12), py: r2(200 + y * 62 - z * 6) });
  const fill = { person: "var(--brand)", company: "var(--aurora)", job: "var(--mint)", skill: "var(--ember)" } as const;
  return (
    <svg ref={svg} viewBox="0 0 400 400" className={className} aria-hidden>
      <g stroke="var(--brand)" strokeOpacity="0.18" strokeWidth="0.8">
        {edges.map(([a, b], i) => {
          const p = project(nodes[a]!.x, nodes[a]!.y, nodes[a]!.z);
          const q = project(nodes[b]!.x, nodes[b]!.y, nodes[b]!.z);
          return <line key={i} x1={p.px} y1={p.py} x2={q.px} y2={q.py} />;
        })}
      </g>
      <g stroke="var(--brand)" strokeWidth="1.4" strokeLinecap="round" fill="none">
        {edges.slice(0, 9).map(([a, b], i) => {
          const p = project(nodes[a]!.x, nodes[a]!.y, nodes[a]!.z);
          const q = project(nodes[b]!.x, nodes[b]!.y, nodes[b]!.z);
          return (
            <line key={i} x1={p.px} y1={p.py} x2={q.px} y2={q.py} strokeDasharray="4 60" opacity="0.8">
              <animate attributeName="stroke-dashoffset" from="64" to="0" dur={`${2.2 + (i % 4) * 0.6}s`} repeatCount="indefinite" />
            </line>
          );
        })}
      </g>
      {nodes.map((n, i) => {
        const { px, py } = project(n.x, n.y, n.z);
        const r = r2(n.size * 46 * (1 + n.z / 9));
        return (
          <g key={i}>
            <circle cx={px} cy={py} r={r * 2.4} fill={fill[n.kind]} opacity="0.1" />
            <circle cx={px} cy={py} r={r} fill={fill[n.kind]} />
          </g>
        );
      })}
    </svg>
  );
}

function FloatCard({ children, className, delay = 0, depth = 1, mx, my }: { children: ReactNode; className?: string; delay?: number; depth?: number; mx: ReturnType<typeof useSpring>; my: ReturnType<typeof useSpring> }) {
  // Whole-pixel offsets: a card parked between pixels gets its text resampled, which looks soft.
  const x = useTransform(mx, (v) => Math.round(v * 14 * depth));
  const y = useTransform(my, (v) => Math.round(v * 10 * depth));
  return (
    // Outer layer: pointer parallax. Inner: entrance. (No idle float: a constantly moving layer keeps text blurry.)
    <m.div className={cn("absolute", className)} style={{ x, y }}>
      <m.div
        initial={{ opacity: 0, y: 24, scale: 0.94 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.9, delay, ease: [0.16, 1, 0.3, 1] }}
      >
        {children}
      </m.div>
    </m.div>
  );
}

export function HeroVisual() {
  const { t, locale } = useI18n();
  const ar = locale === "ar";
  // Turning on "reduce motion" while the page is open swaps the 3D scene for the (paused) SVG.
  const reducedMotion = useReducedMotion();
  const can3D = useCan3D() && !reducedMotion;
  const { resolvedTheme } = useTheme();
  const palette = PALETTES[resolvedTheme === "dark" ? "dark" : "light"];
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const mx = useSpring(rawX, { stiffness: 60, damping: 18 });
  const my = useSpring(rawY, { stiffness: 60, damping: 18 });

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      rawX.set((e.clientX / window.innerWidth) * 2 - 1);
      rawY.set((e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [rawX, rawY]);

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[640px]">
      {/* Soft orbit rings */}
      <div className="absolute inset-[6%] rounded-full border border-brand/10" />
      <div className="absolute inset-[18%] rounded-full border border-dashed border-brand/10" />
      <div className="absolute inset-[22%] rounded-full bg-[radial-gradient(circle,color-mix(in_oklch,var(--brand)_16%,transparent),transparent_70%)]" />

      <NetworkFallback className={cn("absolute inset-0 size-full transition-opacity duration-700", can3D ? "opacity-0" : "opacity-100")} />
      {can3D && <NetworkScene palette={palette} className="absolute inset-0 animate-[fade-in_1.2s_ease-out]" />}

      {/* Profile card */}
      <FloatCard className="start-0 top-[8%] w-[230px] max-sm:start-[-4%] max-sm:w-[200px]" delay={0.3} depth={1.4} mx={mx} my={my}>
        <div className="rounded-2xl border border-border-strong bg-surface p-3.5 shadow-float">
          <div className="flex items-center gap-3">
            <Avatar name="Lina Haddad" size="md" online />
            <div className="min-w-0">
              <div className="flex items-center gap-1 text-sm font-semibold">
                Lina Haddad <BadgeCheck className="size-3.5 text-brand" />
              </div>
              <div className="truncate text-xs text-fg-muted">{ar ? "مصممة منتجات أولى" : "Senior Product Designer"}</div>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-1">
            {(ar ? ["Figma", "أبحاث المستخدم", "أنظمة التصميم"] : ["Figma", "UX Research", "Design Systems"]).map((s) => (
              <span key={s} className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-medium text-fg-muted">
                {s}
              </span>
            ))}
          </div>
          <OpenToWorkBadge className="mt-3" />
        </div>
      </FloatCard>

      {/* Job card with transparent match */}
      <FloatCard className="end-0 top-[38%] w-[250px] max-sm:end-[-4%] max-sm:w-[215px]" delay={0.55} depth={2} mx={mx} my={my}>
        <div className="rounded-2xl border border-border-strong bg-surface p-4 shadow-float">
          <div className="flex items-start gap-3">
            <CompanyLogo name="Northwind" color="#2f9fd3" size="sm" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold">{ar ? "مهندس واجهات أمامية" : "Frontend Engineer"}</div>
              <div className="flex items-center gap-1 text-xs text-fg-muted">
                <MapPin className="size-3" /> Northwind · {t("enums.workMode.REMOTE")}
              </div>
            </div>
            <MatchRing score={94} size={46} stroke={4} />
          </div>
          <ul className="mt-3 space-y-1 text-[13px] text-fg-muted">
            {[t("match.r.hlSkills", { n: 8 }), t("match.r.hlExperience"), t("match.r.hlRemote")].map((h) => (
              <li key={h} className="flex items-center gap-1.5">
                <Check className="size-3 text-mint" strokeWidth={3} /> {h}
              </li>
            ))}
          </ul>
        </div>
      </FloatCard>

      {/* Company card */}
      <FloatCard className="bottom-[6%] start-[8%] w-[220px] max-sm:hidden" delay={0.8} depth={1.1} mx={mx} my={my}>
        <div className="flex items-center gap-3 rounded-2xl border border-border-strong bg-surface p-3.5 shadow-float">
          <CompanyLogo name="Aurora Labs" color="#6a4cf0" size="md" />
          <div className="min-w-0">
            <div className="text-sm font-semibold">Aurora Labs</div>
            <div className="flex items-center gap-1 text-xs text-fg-muted">
              <Building2 className="size-3" /> {t("landing.heroOpenRoles", { n: 24 })}
            </div>
          </div>
        </div>
      </FloatCard>

      {/* Skill nodes */}
      {[
        { s: "React", c: "end-[14%] top-[10%]", d: 0.9 },
        { s: "Python", c: "end-[6%] bottom-[18%]", d: 1.05 },
        { s: ar ? "تحليل البيانات" : "Data Analysis", c: "start-[30%] top-[46%] max-sm:hidden", d: 1.2 },
      ].map(({ s, c, d }) => (
        <FloatCard key={s} className={c} delay={d} depth={0.7} mx={mx} my={my}>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border-strong bg-surface px-3 py-1.5 text-xs font-medium shadow-card">
            <Sparkles className="size-3 text-ember" />
            {s}
          </span>
        </FloatCard>
      ))}
    </div>
  );
}
