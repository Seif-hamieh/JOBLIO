"use client";

import { Msg } from "@/i18n/msg";
import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const control =
  "w-full rounded-xl border border-border-strong bg-surface px-3.5 text-sm text-fg shadow-[var(--shadow-sm)] transition-[border-color,box-shadow] duration-200 " +
  "hover:border-fg-subtle/60 focus:border-brand focus:outline-none focus:ring-4 focus:ring-[var(--ring)]/25 " +
  "disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-danger aria-[invalid=true]:focus:ring-danger/20";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(function Input(
  { className, invalid, ...props },
  ref,
) {
  return <input ref={ref} aria-invalid={invalid || undefined} className={cn(control, "h-11", className)} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }>(
  function Textarea({ className, invalid, ...props }, ref) {
    return (
      <textarea ref={ref} aria-invalid={invalid || undefined} className={cn(control, "min-h-28 resize-y py-3 leading-relaxed", className)} {...props} />
    );
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }>(function Select(
  { className, invalid, children, ...props },
  ref,
) {
  return (
    <div className="relative">
      <select ref={ref} aria-invalid={invalid || undefined} className={cn(control, "h-11 appearance-none pe-10", className)} {...props}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute end-3.5 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" />
    </div>
  );
});

export function Label({ htmlFor, children, className }: { htmlFor?: string; children: ReactNode; className?: string }) {
  return (
    <label htmlFor={htmlFor} className={cn("text-[13px] font-medium text-fg", className)}>
      {children}
    </label>
  );
}

/**
 * Label + control + hint/error, wired up for accessibility. The child receives
 * `id`, `aria-describedby` and `invalid` through the render function.
 */
export function Field({
  label,
  hint,
  error,
  optional,
  className,
  children,
}: {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string | string[];
  optional?: boolean;
  className?: string;
  children: (props: { id: string; "aria-describedby"?: string; invalid: boolean }) => ReactNode;
}) {
  const id = useId();
  const msg = Array.isArray(error) ? error[0] : error;
  const describedBy = msg ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <Label htmlFor={id}>
          {label}
          {optional && <span className="ms-1 font-normal text-fg-subtle">(<Msg k="common.optional" />)</span>}
        </Label>
      )}
      {children({ id, "aria-describedby": describedBy, invalid: !!msg })}
      {msg ? (
        <p id={`${id}-error`} className="text-xs font-medium text-danger-fg" role="alert">
          {msg}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-fg-subtle">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function FormMessage({ state }: { state: { ok: boolean; error?: string; message?: string } | null | undefined }) {
  if (!state) return null;
  const text = state.ok ? state.message : state.error;
  if (!text) return null;
  return (
    <p
      role={state.ok ? "status" : "alert"}
      className={cn(
        "rounded-xl px-3.5 py-2.5 text-sm",
        state.ok ? "bg-mint-soft text-mint-fg" : "bg-danger-soft text-danger-fg",
      )}
    >
      {text}
    </p>
  );
}
