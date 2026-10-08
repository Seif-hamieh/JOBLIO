"use client";

import { m } from "motion/react";

// Re-mounts on every navigation inside the app, giving each page a short,
// subtle entrance. Kept under 250ms so navigation never feels slow.
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  return (
    <m.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}>
      {children}
    </m.div>
  );
}
