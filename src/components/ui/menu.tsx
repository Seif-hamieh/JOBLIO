"use client";

import { DropdownMenu as DM } from "radix-ui";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/utils";

export const Menu = DM.Root;
export const MenuTrigger = DM.Trigger;

export function MenuContent({ className, align = "end", sideOffset = 8, ...props }: ComponentPropsWithoutRef<typeof DM.Content>) {
  return (
    <DM.Portal>
      <DM.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "z-50 min-w-48 overflow-hidden rounded-2xl border border-border bg-surface p-1.5 shadow-float",
          "origin-[var(--radix-dropdown-menu-content-transform-origin)] [animation:menu-in_0.18s_cubic-bezier(0.16,1,0.3,1)]",
          className,
        )}
        {...props}
      />
    </DM.Portal>
  );
}

export function MenuItem({
  className,
  icon,
  danger,
  children,
  ...props
}: ComponentPropsWithoutRef<typeof DM.Item> & { icon?: ReactNode; danger?: boolean }) {
  return (
    <DM.Item
      className={cn(
        "flex cursor-pointer select-none items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm outline-none transition-colors",
        "data-[highlighted]:bg-surface-2 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:size-4",
        danger ? "text-danger-fg" : "text-fg",
        className,
      )}
      {...props}
    >
      {icon && <span className={cn("text-fg-subtle", danger && "text-danger-fg")}>{icon}</span>}
      {children}
    </DM.Item>
  );
}

export function MenuLabel({ className, ...props }: ComponentPropsWithoutRef<typeof DM.Label>) {
  return <DM.Label className={cn("px-2.5 pb-1 pt-2 text-xs font-medium text-fg-subtle", className)} {...props} />;
}

export function MenuSeparator() {
  return <DM.Separator className="my-1.5 h-px bg-border" />;
}
