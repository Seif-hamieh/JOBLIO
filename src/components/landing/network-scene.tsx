"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { buildNetwork, type NodeKind } from "./network-data";

// three r183+ deprecates THREE.Clock, which @react-three/fiber 9.x still creates
// internally (fiber v10 moves to THREE.Timer). Our code doesn't use Clock, so drop
// only that one notice through three's own console hook; everything else passes through.
THREE.setConsoleFunction((level, message, ...params) => {
  if (level === "warn" && typeof message === "string" && message.startsWith("THREE.Clock:")) return;
  const out = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  out(message, ...params);
});

export type ScenePalette = Record<NodeKind, string> & { line: string; pulse: string };

const PULSES = 14;

function Network({ palette, pointer }: { palette: ScenePalette; pointer: React.RefObject<{ x: number; y: number }> }) {
  const { nodes, edges } = useMemo(() => buildNetwork(), []);
  const group = useRef<THREE.Group>(null);
  const core = useRef<THREE.InstancedMesh>(null);
  const halo = useRef<THREE.InstancedMesh>(null);
  const pulseGeo = useRef<THREE.BufferGeometry>(null);

  const linePositions = useMemo(() => {
    const arr = new Float32Array(edges.length * 6);
    edges.forEach(([a, b], i) => {
      const p = nodes[a]!;
      const q = nodes[b]!;
      arr.set([p.x, p.y, p.z, q.x, q.y, q.z], i * 6);
    });
    return arr;
  }, [nodes, edges]);

  const pulseState = useMemo(
    () => Array.from({ length: PULSES }, (_, i) => ({ edge: (i * 7) % edges.length, t: i / PULSES, speed: 0.25 + ((i * 37) % 10) / 25 })),
    [edges.length],
  );
  const pulsePositions = useMemo(() => new Float32Array(PULSES * 3), []);

  useLayoutEffect(() => {
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    nodes.forEach((n, i) => {
      dummy.position.set(n.x, n.y, n.z);
      dummy.scale.setScalar(n.size);
      dummy.updateMatrix();
      core.current!.setMatrixAt(i, dummy.matrix);
      dummy.scale.setScalar(n.size * 2.6);
      dummy.updateMatrix();
      halo.current!.setMatrixAt(i, dummy.matrix);
      color.set(palette[n.kind]);
      core.current!.setColorAt(i, color);
      halo.current!.setColorAt(i, color);
    });
    for (const mesh of [core.current!, halo.current!]) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }, [nodes, palette]);

  useFrame((state, delta) => {
    const g = group.current;
    if (!g) return;
    const dt = Math.min(delta, 0.05);
    g.rotation.y += dt * 0.07;
    // Gentle pointer parallax, eased.
    const p = pointer.current ?? { x: 0, y: 0 };
    g.rotation.x += (p.y * 0.25 - g.rotation.x) * 0.04;
    g.rotation.z += (-p.x * 0.08 - g.rotation.z) * 0.04;
    g.position.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.06;

    // Signals travelling along connections.
    pulseState.forEach((s, i) => {
      s.t += dt * s.speed;
      if (s.t >= 1) {
        s.t = 0;
        s.edge = (s.edge + 11 + i) % edges.length;
      }
      const [a, b] = edges[s.edge]!;
      const p1 = nodes[a]!;
      const p2 = nodes[b]!;
      pulsePositions[i * 3] = p1.x + (p2.x - p1.x) * s.t;
      pulsePositions[i * 3 + 1] = p1.y + (p2.y - p1.y) * s.t;
      pulsePositions[i * 3 + 2] = p1.z + (p2.z - p1.z) * s.t;
    });
    const attr = pulseGeo.current?.getAttribute("position");
    if (attr) attr.needsUpdate = true;
  });

  return (
    <group ref={group}>
      <lineSegments>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[linePositions, 3]} />
        </bufferGeometry>
        <lineBasicMaterial color={palette.line} transparent opacity={0.32} depthWrite={false} />
      </lineSegments>
      <instancedMesh ref={halo} args={[undefined, undefined, nodes.length]}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshBasicMaterial transparent opacity={0.12} depthWrite={false} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={core} args={[undefined, undefined, nodes.length]}>
        <icosahedronGeometry args={[1, 2]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      <points>
        <bufferGeometry ref={pulseGeo}>
          <bufferAttribute attach="attributes-position" args={[pulsePositions, 3]} usage={THREE.DynamicDrawUsage} />
        </bufferGeometry>
        <pointsMaterial color={palette.pulse} size={0.075} sizeAttenuation transparent opacity={0.95} depthWrite={false} toneMapped={false} />
      </points>
    </group>
  );
}

/**
 * Renders at most `fps` frames a second (the Canvas runs with frameloop="demand"). The motion is slow,
 * so 30 fps looks the same as 60 and halves the main-thread and GPU work.
 */
function FrameLimiter({ fps }: { fps: number }) {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    const id = window.setInterval(() => invalidate(), 1000 / fps);
    return () => window.clearInterval(id);
  }, [invalidate, fps]);
  return null;
}

export default function NetworkScene({ palette, className }: { palette: ScenePalette; className?: string }) {
  const wrapper = useRef<HTMLDivElement>(null);
  const pointer = useRef({ x: 0, y: 0 });
  const [inView, setInView] = useState(true);
  const [pageVisible, setPageVisible] = useState(true);
  const visible = inView && pageVisible;

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      pointer.current = { x: (e.clientX / window.innerWidth) * 2 - 1, y: (e.clientY / window.innerHeight) * 2 - 1 };
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    // Stop rendering entirely when the hero scrolls out of view or the tab hides.
    const io = new IntersectionObserver(([entry]) => setInView(!!entry?.isIntersecting), { threshold: 0.01 });
    if (wrapper.current) io.observe(wrapper.current);
    const onVis = () => setPageVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("visibilitychange", onVis);
      io.disconnect();
    };
  }, []);

  return (
    <div ref={wrapper} className={className}>
      <Canvas
        dpr={[1, 1.6]}
        camera={{ position: [0, 0, 7.2], fov: 42 }}
        gl={{ antialias: true, alpha: true, powerPreference: "default" }}
        frameloop={visible ? "demand" : "never"}
        aria-hidden
      >
        {visible && <FrameLimiter fps={30} />}
        <Network palette={palette} pointer={pointer} />
      </Canvas>
    </div>
  );
}
