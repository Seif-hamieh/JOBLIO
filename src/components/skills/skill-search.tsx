"use client";

import { useI18n } from "@/i18n/client";
import { useEffect, useId, useRef, useState } from "react";
import { Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { categoryName } from "@/i18n/translate";

export type SkillOption = { id: string; name: string; slug: string; category: string };

/** Accessible combobox over the structured skill taxonomy. */
export function SkillSearch({
  onSelect,
  exclude = [],
  placeholder,
  className,
}: {
  onSelect: (skill: SkillOption) => void;
  exclude?: string[];
  placeholder?: string;
  className?: string;
}) {
  const { t } = useI18n();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<SkillOption[]>([]);
  const [active, setActive] = useState(0);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/v1/skills?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        if (!res.ok) return;
        const data = (await res.json()) as { skills: SkillOption[] };
        setResults(data.skills);
        setActive(0);
      } catch {}
    }, 140);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q, open]);

  const visible = results.filter((r) => !exclude.includes(r.id));

  // Close the list after each pick so a second click can't add another skill by accident;
  // typing or clicking the field opens it again.
  function choose(s: SkillOption) {
    onSelect(s);
    setQ("");
    setOpen(false);
    inputRef.current?.focus();
  }

  return (
    <div className={cn("relative", className)}>
      <div className="flex h-11 items-center gap-2 rounded-xl border border-border bg-surface px-3.5 shadow-soft transition focus-within:border-brand focus-within:ring-4 focus-within:ring-[var(--ring)]/25">
        <Search className="size-4 text-fg-subtle" />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, visible.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === "Enter" && visible[active]) {
              e.preventDefault();
              choose(visible[active]);
            } else if (e.key === "Escape") setOpen(false);
          }}
          placeholder={placeholder ?? t("skills.searchPlaceholder")}
          maxLength={50}
          className="h-full flex-1 bg-transparent text-sm outline-none"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
        />
      </div>
      {open && visible.length > 0 && (
        <ul id={listId} role="listbox" className="absolute z-30 mt-1.5 max-h-72 w-full overflow-auto rounded-2xl border border-border bg-surface p-1.5 shadow-float">
          {visible.map((s, i) => (
            <li
              key={s.id}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(s);
              }}
              onMouseEnter={() => setActive(i)}
              className={cn("flex cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-sm", i === active && "bg-surface-2")}
            >
              <span className="flex items-center gap-2">
                <Plus className="size-3.5 text-fg-subtle" />
                {s.name}
              </span>
              <span className="text-xs text-fg-subtle">{categoryName(t, s.category)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
