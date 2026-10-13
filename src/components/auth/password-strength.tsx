"use client";

import { assessPassword } from "@/lib/password";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";

/** Weak / medium / strong meter with the reason a password would be refused. */
export function PasswordStrength({ password, personal = [] }: { password: string; personal?: (string | null | undefined)[] }) {
  const { t } = useI18n();
  if (!password) return null;
  const { score, level, problem } = assessPassword(password, personal);
  const tone = level === "weak" ? "bg-danger" : level === "medium" ? "bg-ember" : "bg-mint";
  return (
    <div aria-live="polite">
      <div className="flex gap-1.5" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={cn("h-1.5 flex-1 rounded-full transition-colors duration-300", i < Math.max(1, score) ? tone : "bg-surface-3")} />
        ))}
      </div>
      <p className={cn("mt-1.5 text-xs", level === "weak" ? "text-danger-fg" : level === "medium" ? "text-ember-fg" : "text-mint-fg")}>
        {t(`auth.strength.${level}`)}
        {problem && <span className="text-fg-muted"> · {t(`auth.weak.${problem}`)}</span>}
      </p>
    </div>
  );
}
