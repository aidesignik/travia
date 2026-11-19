import { DRIVER_COLORS, resolveDriverColor } from "@/lib/driver-colors";

export type DriverAvatarSize = 20 | 24 | 26 | 32 | 36 | 40 | 56;

const SIZE_STYLE: Record<DriverAvatarSize, { fontSize: string; fontWeight: number }> = {
  20: { fontSize: "8.5px", fontWeight: 700 },
  24: { fontSize: "10px", fontWeight: 600 },
  26: { fontSize: "10.5px", fontWeight: 600 },
  32: { fontSize: "12.5px", fontWeight: 600 },
  36: { fontSize: "13px", fontWeight: 600 },
  40: { fontSize: "15px", fontWeight: 600 },
  56: { fontSize: "20px", fontWeight: 600 },
};

export interface DriverAvatarDriver {
  id: string;
  name: string;
  avatarColor?: string | null;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// The single shared avatar for drivers everywhere they appear (calendar
// cards, Vozači rows, booking detail, filters, ...) — a driver's look
// comes only from their stored avatarColor (see src/lib/driver-colors.ts),
// never derived at render time, so the same person always looks the same.
export function DriverAvatar({
  driver,
  size = 26,
  variant = "soft",
  ring = false,
  decorative = false,
  className,
}: {
  driver: DriverAvatarDriver | null | undefined;
  size?: DriverAvatarSize;
  // "soft": tinted background + colored initials (the default everywhere).
  // "solid": filled with the color's fg + white initials — selected states
  // and active filter chips only.
  variant?: "soft" | "solid";
  // Adds a 1.5px white ring — use when the avatar sits on a colored
  // background (e.g. the status-tinted booking cards).
  ring?: boolean;
  // The name is already visible right next to the avatar, so the avatar
  // itself carries no independent label.
  decorative?: boolean;
  className?: string;
}) {
  const dims = { width: size, height: size };
  const { fontSize, fontWeight } = SIZE_STYLE[size];

  if (!driver) {
    return (
      <div
        aria-hidden
        style={dims}
        className={`flex shrink-0 items-center justify-center rounded-full border-[1.5px] border-dashed border-[var(--border-strong)] text-[var(--ink-disabled)] ${className ?? ""}`}
      >
        –
      </div>
    );
  }

  const colorKey = resolveDriverColor(driver.avatarColor, driver.id);
  const { bg, fg } = DRIVER_COLORS[colorKey];
  const a11yProps = decorative
    ? { "aria-hidden": true as const }
    : { title: driver.name, "aria-label": driver.name };

  return (
    <div
      {...a11yProps}
      style={{
        ...dims,
        fontSize,
        fontWeight,
        background: variant === "solid" ? fg : bg,
        color: variant === "solid" ? "white" : fg,
        letterSpacing: "0.02em",
        boxShadow: ring ? "0 0 0 1.5px white" : undefined,
      }}
      className={`flex shrink-0 items-center justify-center rounded-full ${className ?? ""}`}
    >
      {initials(driver.name)}
    </div>
  );
}
