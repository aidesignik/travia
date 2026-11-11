import { useTranslations } from "next-intl";
import { RIDE_STATUS_BG, RIDE_STATUS_TEXT } from "./statusStyles";
import { clientDisplayName } from "@/lib/clientDisplay";
import { displayRideStatus } from "@/lib/rideStatus";
import type { CalendarRide } from "./types";

// The month grid's ride bar: spans the days the ride covers, and shows just
// the two things a dispatcher scans a month for — where the ride goes and
// who it's for. The status is the bar's own colour (same fills as the week
// cards); everything else (pickup, time, driver) is in the tooltip and one
// click away in the ride drawer. Where a ride wraps onto the next week row,
// the bar's ends on that side are square, so the pieces read as one ride,
// and hovering any piece highlights every piece (MonthGrid tracks which ride
// is hovered and passes `hovered` to all of its bars).
export function RideMonthBar({
  ride,
  onClick,
  continuesBefore = false,
  continuesAfter = false,
  hovered = false,
  onHoverChange,
}: {
  ride: CalendarRide;
  onClick: () => void;
  continuesBefore?: boolean;
  continuesAfter?: boolean;
  hovered?: boolean;
  onHoverChange?: (hovered: boolean) => void;
}) {
  const t = useTranslations("carrier.calendar");
  const status = displayRideStatus(ride);
  const client = clientDisplayName(ride.client);
  const time = new Date(ride.departureAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  const route = `${ride.pickupCity} ${ride.isRoundTrip ? "⇄" : "→"} ${ride.destinationCity}`;

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => onHoverChange?.(true)}
      onMouseLeave={() => onHoverChange?.(false)}
      onFocus={() => onHoverChange?.(true)}
      onBlur={() => onHoverChange?.(false)}
      title={`${route} · ${client} · ${time}`}
      aria-label={t("monthBarAriaLabel", { route, client, time })}
      className={`relative flex h-full w-full min-w-0 cursor-pointer items-center overflow-hidden px-[10px] text-left transition-[box-shadow,translate] duration-[.12s] ease-out ${
        hovered ? "-translate-y-px shadow-[0_1px_2px_rgba(20,20,19,.06),0_4px_12px_rgba(20,20,19,.06)]" : ""
      }`}
      style={{
        background: RIDE_STATUS_BG[status],
        borderRadius: `${continuesBefore ? 0 : 8}px ${continuesAfter ? 0 : 8}px ${continuesAfter ? 0 : 8}px ${continuesBefore ? 0 : 8}px`,
      }}
    >
      <span
        aria-hidden
        className={`pointer-events-none absolute inset-0 transition-colors duration-[.12s] ease-out ${hovered ? "bg-[rgba(20,20,19,.04)]" : "bg-[rgba(20,20,19,0)]"}`}
      />
      {/* One line: destination, then the client — the client gives way
          (ellipsis) first when the bar is narrow. */}
      <span className="relative flex min-w-0 items-baseline gap-[5px] text-[12.5px] leading-[16px]">
        <span
          className="max-w-full shrink-0 truncate font-semibold"
          style={{ color: status === "CANCELLED" ? "var(--ink-muted)" : "var(--ink-primary)" }}
        >
          {ride.destinationCity}
        </span>
        <span aria-hidden className="shrink-0" style={{ color: RIDE_STATUS_TEXT[status], opacity: 0.6 }}>
          ·
        </span>
        <span className="min-w-0 truncate" style={{ color: RIDE_STATUS_TEXT[status] }}>
          {client}
        </span>
      </span>
    </button>
  );
}
