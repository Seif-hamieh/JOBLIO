"use client";

import { Msg } from "@/i18n/msg";
import Link from "next/link";
import { m, useReducedMotion } from "motion/react";
import { Avatar } from "@/components/ui/avatar";

type Person = { id: string; name: string; image: string | null; username: string };

/**
 * Your network as orbits: you at the centre, connections on rings that
 * slowly rotate. Pure CSS transforms — cheap on every device.
 */
export function NetworkOrbit({ me, people, total }: { me: Person; people: Person[]; total: number }) {
  const reduce = useReducedMotion();
  const rings = [people.slice(0, 6), people.slice(6, 16)];
  const radii = [34, 47];
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[340px]">
      {radii.map((r) => (
        <div key={r} className="absolute rounded-full border border-dashed border-brand/20" style={{ inset: `${50 - r}%` }} />
      ))}
      <div className="absolute inset-[38%] rounded-full bg-[radial-gradient(circle,color-mix(in_oklch,var(--brand)_22%,transparent),transparent_70%)]" />
      {rings.map((ring, ri) => (
        <m.div
          key={ri}
          className="absolute inset-0"
          animate={reduce ? undefined : { rotate: ri === 0 ? 360 : -360 }}
          transition={{ duration: ri === 0 ? 90 : 140, repeat: Infinity, ease: "linear" }}
        >
          {ring.map((p, i) => {
            const angle = (i / ring.length) * Math.PI * 2 + ri * 0.4;
            const x = 50 + Math.cos(angle) * radii[ri]!;
            const y = 50 + Math.sin(angle) * radii[ri]!;
            return (
              <m.div
                key={p.id}
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${x.toFixed(2)}%`, top: `${y.toFixed(2)}%` }}
                initial={{ opacity: 0, scale: 0.4 }}
                animate={{ opacity: 1, scale: 1, rotate: reduce ? 0 : ri === 0 ? -360 : 360 }}
                transition={{
                  opacity: { delay: 0.2 + i * 0.05 },
                  scale: { delay: 0.2 + i * 0.05, type: "spring", stiffness: 300, damping: 18 },
                  rotate: { duration: ri === 0 ? 90 : 140, repeat: Infinity, ease: "linear" },
                }}
              >
                <Link href={`/in/${p.username}`} title={p.name} className="block transition hover:scale-110">
                  <Avatar name={p.name} src={p.image} size={ri === 0 ? "md" : "sm"} ring />
                </Link>
              </m.div>
            );
          })}
        </m.div>
      ))}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
        <Avatar name={me.name} src={me.image} size="xl" ring />
        <div className="mt-1.5 font-display text-sm font-semibold"><Msg k="common.connections" vars={{ n: total }} /></div>
      </div>
    </div>
  );
}
