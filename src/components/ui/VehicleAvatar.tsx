import { Bus, BusFront, Truck, Van } from "lucide-react";

const GLYPH_BY_TYPE: Record<string, typeof Bus> = {
  COACH: Bus,
  MIDIBUS: Bus,
  DOUBLE_DECKER: BusFront,
  MINIBUS: Truck,
  VAN: Van,
};

const SIZE = {
  md: { box: "h-[34px] w-[34px]", icon: 19, radius: "rounded-control" },
  sm: { box: "h-8 w-8", icon: 19, radius: "rounded-control" },
  xs: { box: "h-7 w-7", icon: 16, radius: "rounded-control" },
} as const;

// Rounded-square identity treatment for vehicles — the opposite shape from
// DriverAvatar's circle so the two entity kinds read apart at a glance
// wherever they appear side by side.
export function VehicleAvatar({
  type,
  typeLabel,
  photoUrl,
  size = "md",
  empty = false,
}: {
  type?: string;
  typeLabel?: string;
  photoUrl?: string | null;
  size?: "xs" | "sm" | "md";
  empty?: boolean;
}) {
  const dims = SIZE[size];

  if (empty || !type) {
    return (
      <div
        title="No vehicle assigned"
        className={`flex ${dims.box} shrink-0 items-center justify-center ${dims.radius} border-[1.5px] border-dashed border-[var(--border-strong)] text-[var(--ink-disabled)]`}
      >
        –
      </div>
    );
  }

  if (photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoUrl}
        alt={typeLabel ?? ""}
        title={typeLabel}
        className={`${dims.box} shrink-0 ${dims.radius} object-cover`}
      />
    );
  }

  const Glyph = GLYPH_BY_TYPE[type] ?? Bus;
  return (
    <div
      title={typeLabel}
      className={`flex ${dims.box} shrink-0 items-center justify-center ${dims.radius} border border-[var(--border-hairline)]`}
    >
      <Glyph size={dims.icon} strokeWidth={1.9} color="var(--ink-2)" />
    </div>
  );
}
