"use client";

import { LazyMotion, MotionConfig, domMax } from "motion/react";
import type { ReactNode } from "react";
import { ThemeProvider } from "@/components/theme";
import { Toaster } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/controls";
import { ServiceWorkerRegistration } from "@/components/pwa/pwa";
import { SpotlightTracker } from "@/components/ui/spotlight-tracker";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <LazyMotion features={domMax}>
        <MotionConfig reducedMotion="user" transition={{ ease: [0.16, 1, 0.3, 1] }}>
          <TooltipProvider>
            {children}
            <Toaster />
            <ServiceWorkerRegistration />
            <SpotlightTracker />
          </TooltipProvider>
        </MotionConfig>
      </LazyMotion>
    </ThemeProvider>
  );
}
