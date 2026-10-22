"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function TagInput({
  value,
  onChange,
  placeholder,
  max = 5,
  maxLength = 80,
  id,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  max?: number;
  maxLength?: number;
  id?: string;
}) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (!v || value.length >= max || value.some((x) => x.toLowerCase() === v.toLowerCase())) return setDraft("");
    onChange([...value, v.slice(0, maxLength)]);
    setDraft("");
  };
  return (
    <div className="flex min-h-11 flex-wrap items-center gap-1.5 rounded-xl border border-border-strong bg-surface px-2 py-1.5 shadow-soft transition focus-within:border-brand focus-within:ring-4 focus-within:ring-[var(--ring)]/25">
      {value.map((t) => (
        <span key={t} className="inline-flex h-7 items-center gap-1 rounded-lg bg-brand-soft ps-2.5 pe-1 text-[13px] font-medium text-brand-soft-fg">
          {t}
          <button type="button" onClick={() => onChange(value.filter((x) => x !== t))} className="rounded p-0.5 hover:bg-brand/10" aria-label={`× ${t}`}>
            <X className="size-3" />
          </button>
        </span>
      ))}
      <input
        id={id}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add();
          } else if (e.key === "Backspace" && !draft && value.length) onChange(value.slice(0, -1));
        }}
        onBlur={add}
        placeholder={value.length >= max ? `Up to ${max}` : placeholder}
        disabled={value.length >= max}
        className={cn("h-7 min-w-32 flex-1 bg-transparent px-1.5 text-sm outline-none")}
      />
    </div>
  );
}
