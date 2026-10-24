"use client";

import { useEffect } from "react";

const MAX_TILT = 5; // degrees

/**
 * Feeds the hover glow and tilt (see "Hover glow and tilt" in globals.css): one pointer listener for the
 * whole document writes the cursor position into CSS variables on the hovered `.spotlight`/`.spotlight-btn`
 * element, at most once per frame. Mouse only, and off when the visitor prefers reduced motion.
 */
export function SpotlightTracker() {
  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)");
    let current: HTMLElement | null = null;
    let last: PointerEvent | null = null;
    let frame = 0;

    const reset = (el: HTMLElement) => {
      for (const v of ["--mx", "--my", "--rx", "--ry"]) el.style.removeProperty(v);
    };
    const apply = () => {
      frame = 0;
      const target = last?.target instanceof Element ? last.target.closest<HTMLElement>(".spotlight, .spotlight-btn") : null;
      if (current && current !== target) reset(current);
      current = target;
      if (!current || !last) return;
      const r = current.getBoundingClientRect();
      const x = last.clientX - r.left;
      const y = last.clientY - r.top;
      current.style.setProperty("--mx", `${x}px`);
      current.style.setProperty("--my", `${y}px`);
      if (current.classList.contains("tilt")) {
        current.style.setProperty("--ry", `${((x / r.width - 0.5) * 2 * MAX_TILT).toFixed(2)}deg`);
        current.style.setProperty("--rx", `${((0.5 - y / r.height) * 2 * MAX_TILT).toFixed(2)}deg`);
      }
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      last = e;
      if (!frame) frame = requestAnimationFrame(apply);
    };
    const onLeave = () => {
      if (current) reset(current);
      current = null;
    };

    const start = () => {
      document.addEventListener("pointermove", onMove, { passive: true });
      document.documentElement.addEventListener("pointerleave", onLeave);
    };
    const stop = () => {
      document.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      cancelAnimationFrame(frame);
      frame = 0;
      onLeave();
    };
    const sync = () => (mq.matches ? start() : stop());
    sync();
    mq.addEventListener("change", sync);
    return () => {
      mq.removeEventListener("change", sync);
      stop();
    };
  }, []);
  return null;
}
