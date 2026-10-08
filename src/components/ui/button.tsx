import { forwardRef, type ButtonHTMLAttributes } from "react";
import { Slot } from "radix-ui";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";

const VARIANTS = {
  primary:
    "bg-brand text-brand-fg shadow-[0_1px_0_0_rgb(255_255_255/0.15)_inset,0_6px_16px_-6px_var(--brand)] hover:bg-brand-hover",
  secondary: "bg-fg text-bg hover:bg-fg/90",
  outline: "border border-border-strong bg-surface text-fg hover:bg-surface-2 hover:border-fg-subtle/50",
  soft: "bg-brand-soft text-brand-soft-fg hover:bg-brand-soft/70",
  ghost: "text-fg-muted hover:text-fg hover:bg-surface-2",
  danger: "bg-danger text-white hover:bg-danger/90",
  mint: "bg-mint text-[oklch(0.2_0.04_166)] hover:bg-mint/90",
} as const;

const SIZES = {
  xs: "h-7 px-2.5 text-xs gap-1 rounded-lg",
  sm: "h-8 px-3 text-[13px] gap-1.5 rounded-lg",
  md: "h-10 px-4 text-sm gap-2 rounded-xl",
  lg: "h-12 px-6 text-[15px] gap-2 rounded-2xl",
  icon: "size-10 rounded-xl",
  "icon-sm": "size-8 rounded-lg",
} as const;

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
  loading?: boolean;
  asChild?: boolean;
  pill?: boolean;
};

export function buttonClasses({
  variant = "primary",
  size = "md",
  pill,
  className,
}: Pick<ButtonProps, "variant" | "size" | "pill" | "className">) {
  return cn(
    "relative inline-flex select-none items-center justify-center whitespace-nowrap font-medium",
    "transition-[background-color,color,border-color,box-shadow,transform] duration-200 ease-out",
    "active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]",
    "[&_svg]:size-4 [&_svg]:shrink-0",
    VARIANTS[variant],
    SIZES[size],
    pill && "rounded-full",
    className,
  );
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, loading, asChild, pill, className, children, disabled, type, ...props },
  ref,
) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      ref={ref}
      type={asChild ? undefined : (type ?? "button")}
      className={buttonClasses({ variant, size, pill, className })}
      disabled={asChild ? undefined : disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          {loading && <Spinner className="absolute" />}
          <span className={cn("inline-flex items-center gap-[inherit]", loading && "invisible")}>{children}</span>
        </>
      )}
    </Comp>
  );
});
