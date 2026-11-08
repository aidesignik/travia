import { useTranslations } from "next-intl";
import { RIDE_STATUS_BG, RIDE_STATUS_TEXT } from "./statusStyles";
import { clientDisplayName } from "@/lib/clientDisplay";
import { displayRideStatus } from "@/lib/rideStatus";
import type { CalendarRide } from "./types";

// The month grid's ride entry: day cells there are too small for the full
// RideBlockCard, so it shows just the two things a dispatcher scans a month
// for — where the ride goes and who it's for. The status is the bar's own
// colour (same fills as the week cards); everything else (pickup, time,
// driver) is in the tooltip and one click away in the ride drawer.
export function RideMonthBar({
  ride,
  onClick,
  dayLabel,
}: {
  ride: CalendarRide;
  onClick: () => void;
  // "2/3" on a multi-day ride's entry for its second of three days.
  dayLabel?: string;
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
      title={`${route} · ${client} · ${time}`}
      aria-label={t("monthBarAriaLabel", { route, client, time })}
      className="group relative flex h-full w-full min-w-0 cursor-pointer flex-col justify-center gap-0 overflow-hidden rounded-[8px] px-[8px] text-left transition-[box-shadow,translate] duration-[.12s] ease-out hover:-translate-y-px hover:shadow-[0_1px_2px_rgba(20,20,19,.06),0_4px_12px_rgba(20,20,19,.06)]"
      style={{ background: RIDE_STATUS_BG[status] }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[rgba(20,20,19,0)] transition-colors duration-[.12s] ease-out group-hover:bg-[rgba(20,20,19,.04)]"
      />
      <span className="relative flex min-w-0 items-center gap-[6px]">
        <span
          className="min-w-0 flex-1 truncate text-[12.5px] font-semibold leading-[16px]"
          style={{ color: status === "CANCELLED" ? "var(--ink-muted)" : "var(--ink-primary)" }}
        >
          {ride.destinationCity}
        </span>
        {dayLabel ? (
          <span className="shrink-0 text-[11px] font-semibold tabular-nums" style={{ color: RIDE_STATUS_TEXT[status] }}>
            {dayLabel}
          </span>
        ) : null}
      </span>
      <span className="relative min-w-0 truncate text-[11.5px] leading-[14px]" style={{ color: RIDE_STATUS_TEXT[status] }}>
        {client}
      </span>
    </button>
  );
}
