"use client";

import { useTheme } from "@/components/theme";
import { Moon, Sun, Monitor } from "lucide-react";
import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/client";

const subscribe = () => () => {};

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const { t } = useI18n();
  // Avoid a hydration mismatch: render a neutral icon until mounted.
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const dark = mounted && resolvedTheme === "dark";
  return (
    <button
      type="button"
      onClick={() => setTheme(dark ? "light" : "dark")}
      className={cn("grid size-11 place-items-center rounded-full text-fg-muted transition hover:bg-surface-2 hover:text-fg md:size-9", className)}
      aria-label={dark ? t("common.switchToLight") : t("common.switchToDark")}
    >
      {!mounted ? <Monitor className="size-[18px]" /> : dark ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
    </button>
  );
}

export function ThemeSelect() {
  const { theme, setTheme } = useTheme();
  const { t } = useI18n();
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const options = [
    { value: "light", label: "common.light", icon: Sun },
    { value: "dark", label: "common.dark", icon: Moon },
    { value: "system", label: "common.system", icon: Monitor },
  ] as const;
  return (
    <div className="grid grid-cols-3 gap-2">
      {options.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          onClick={() => setTheme(value)}
          className={cn(
            "flex flex-col items-center gap-2 rounded-2xl border p-4 text-sm font-medium transition",
            mounted && theme === value ? "border-brand bg-brand-soft text-brand-soft-fg" : "border-border hover:border-border-strong",
          )}
        >
          <Icon className="size-5" />
          {t(label)}
        </button>
      ))}
    </div>
  );
}
