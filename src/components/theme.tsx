"use client";

import { createContext, use, useCallback, useEffect, useState, type ReactNode } from "react";

// Minimal light/dark/system theming. A static inline script in <head>
// (see ThemeScript) applies the class before first paint, so there's no
// flash of the wrong theme; this provider handles changes afterwards.

export type ThemeChoice = "light" | "dark" | "system";
const KEY = "joblio-theme";

type Ctx = { theme: ThemeChoice; resolvedTheme: "light" | "dark"; setTheme: (t: ThemeChoice) => void };
const ThemeContext = createContext<Ctx>({ theme: "system", resolvedTheme: "light", setTheme: () => {} });

function systemDark() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function apply(theme: ThemeChoice) {
  const dark = theme === "dark" || (theme === "system" && systemDark());
  const root = document.documentElement;
  root.classList.add("[&_*]:!transition-none");
  root.classList.toggle("dark", dark);
  root.style.colorScheme = dark ? "dark" : "light";
  // Suppress transitions for one frame so colours switch instantly.
  requestAnimationFrame(() => root.classList.remove("[&_*]:!transition-none"));
  return dark ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeChoice>("system");
  const [resolvedTheme, setResolved] = useState<"light" | "dark">("light");

  useEffect(() => {
    let stored: ThemeChoice = "system";
    try {
      stored = (localStorage.getItem(KEY) as ThemeChoice) || "system";
    } catch {}
    setThemeState(stored);
    setResolved(document.documentElement.classList.contains("dark") ? "dark" : "light");
  }, []);

  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setResolved(apply("system"));
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = useCallback((t: ThemeChoice) => {
    try {
      localStorage.setItem(KEY, t);
    } catch {}
    setThemeState(t);
    setResolved(apply(t));
  }, []);

  return <ThemeContext value={{ theme, resolvedTheme, setTheme }}>{children}</ThemeContext>;
}

export function useTheme() {
  return use(ThemeContext);
}
