import { Msg } from "@/i18n/msg";
import { cn, hashString, initials } from "@/lib/utils";

const SIZES = {
  xs: "size-6 text-[10px]",
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-14 text-lg",
  xl: "size-20 text-2xl",
  "2xl": "size-32 text-4xl",
} as const;

// Hand-picked hue pairs so generated avatars always look intentional.
const PALETTES = [
  [281, 222],
  [222, 166],
  [166, 120],
  [32, 350],
  [350, 281],
  [255, 200],
  [190, 140],
  [60, 20],
] as const;

export function gradientFor(seed: string) {
  const [a, b] = PALETTES[hashString(seed) % PALETTES.length]!;
  return `linear-gradient(135deg, oklch(0.72 0.14 ${a}), oklch(0.6 0.16 ${b}))`;
}

export function Avatar({
  name,
  src,
  size = "md",
  online,
  ring,
  className,
}: {
  name: string;
  src?: string | null;
  size?: keyof typeof SIZES;
  online?: boolean;
  ring?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("relative inline-flex shrink-0", className)}>
      <span
        className={cn(
          "inline-flex items-center justify-center overflow-hidden rounded-full font-display font-semibold text-white",
          ring && "ring-[3px] ring-surface",
          SIZES[size],
        )}
        style={src ? undefined : { background: gradientFor(name) }}
        aria-hidden={!src}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element -- user uploads are served by our own file route
          <img src={src} alt={name} className="size-full object-cover" loading="lazy" decoding="async" />
        ) : (
          initials(name)
        )}
      </span>
      {online !== undefined && (
        <span
          className={cn(
            "absolute bottom-0 end-0 block rounded-full ring-2 ring-surface",
            size === "xs" || size === "sm" ? "size-2" : "size-3",
            online ? "bg-mint" : "bg-fg-subtle/40",
          )}
        >
          <span className="sr-only">{online ? <Msg k="messages.online" /> : null}</span>
        </span>
      )}
    </span>
  );
}

const LOGO_SIZES = {
  sm: "size-8 rounded-lg text-xs",
  md: "size-11 rounded-xl text-base",
  lg: "size-14 rounded-2xl text-xl",
  xl: "size-24 rounded-3xl text-3xl",
} as const;

export function CompanyLogo({
  name,
  src,
  color,
  size = "md",
  className,
}: {
  name: string;
  src?: string | null;
  color?: string | null;
  size?: keyof typeof LOGO_SIZES;
  className?: string;
}) {
  const bg = color ?? undefined;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden border border-border bg-surface font-display font-bold",
        LOGO_SIZES[size],
        className,
      )}
      style={!src ? { background: bg ? `linear-gradient(140deg, ${bg}, color-mix(in oklch, ${bg} 70%, black))` : gradientFor(name), color: "white", borderColor: "transparent" } : undefined}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={`${name} logo`} className="size-full object-contain p-1.5" loading="lazy" />
      ) : (
        name.replace(/[^A-Za-z0-9]/g, "").slice(0, 1).toUpperCase() || "•"
      )}
    </span>
  );
}

export function AvatarStack({ people, max = 4, size = "sm" }: { people: { name: string; image?: string | null }[]; max?: number; size?: "xs" | "sm" }) {
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  return (
    <span className="flex -space-x-2">
      {shown.map((p, i) => (
        <Avatar key={i} name={p.name} src={p.image} size={size} ring />
      ))}
      {extra > 0 && (
        <span className={cn("inline-flex items-center justify-center rounded-full bg-surface-3 font-medium text-fg-muted ring-[3px] ring-surface", SIZES[size])}>
          +{extra}
        </span>
      )}
    </span>
  );
}
