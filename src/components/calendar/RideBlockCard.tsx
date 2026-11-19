import type { CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { ArrowRight, ArrowLeftRight } from "lucide-react";
import { RIDE_STATUS_BG, RIDE_STATUS_DOT, RIDE_STATUS_TEXT } from "./statusStyles";
import { DriverAvatar, type DriverAvatarDriver } from "@/components/ui/DriverAvatar";
import { clientDisplayName } from "@/lib/clientDisplay";
import { displayRideStatus } from "@/lib/rideStatus";
import { cityCode } from "@/lib/cityCodes";
import type { CalendarRide, RideStatus } from "./types";

// Status tag — top-right corner, top-aligned with the route title (same
// row). One component for every card: full (dot + label) once the card
// is wide enough, collapsing to the same pill shrunk to a 22×22px circle
// around the dot when it isn't, so size/colors/position can never drift
// between the two. With `compact` omitted (the normal case), both
// variants render and the card's own container query (not its day span)
// picks which one shows, switching under ~170px; pass `compact`
// explicitly only to force one.
function StatusTag({ status, compact }: { status: RideStatus; compact?: boolean }) {
  const t = useTranslations("carrier.calendar");
  const label = t(`legend.${status}`);
  const dot = RIDE_STATUS_DOT[status];
  const auto = compact === undefined;

  return (
    <>
      {compact !== false ? (
        <span
          className={`${auto ? "hidden @max-[170px]:flex" : "flex"} h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full`}
          style={{ background: "rgba(255,255,255,.7)" }}
          title={label}
          aria-label={t("statusAriaLabel", { status: label })}
        >
          <span aria-hidden className="h-[6px] w-[6px] shrink-0 rounded-full" style={{ background: dot }} />
        </span>
      ) : null}
      {compact !== true ? (
        <span
          className={`${auto ? "flex @max-[170px]:hidden" : "flex"} h-[22px] shrink-0 items-center gap-[5px] rounded-full px-[8px]`}
          style={{ background: "rgba(255,255,255,.7)" }}
        >
          <span aria-hidden className="h-[6px] w-[6px] shrink-0 rounded-full" style={{ background: dot }} />
          <span className="text-[12px] font-semibold" style={{ color: RIDE_STATUS_TEXT[status] }}>
            {label}
          </span>
        </span>
      ) : null}
    </>
  );
}

export function RideBlockCard({
  ride,
  onClick,
  style,
  seats,
  driver,
}: {
  ride: CalendarRide;
  onClick: () => void;
  style?: CSSProperties;
  seats?: number | null;
  driver?: DriverAvatarDriver | null;
}) {
  const t = useTranslations("carrier.calendar");
  const time = new Date(ride.departureAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const clientLabel = clientDisplayName(ride.client);
  const status = displayRideStatus(ride);
  const background = RIDE_STATUS_BG[status];
  const routeArrow = ride.isRoundTrip ? "⇄" : "→";
  const route = `${ride.pickupCity} ${routeArrow} ${ride.destinationCity}`;
  const ariaLabel = t("cardAriaLabel", {
    route,
    client: clientLabel,
    time,
    driver: driver?.name ?? t("detail.noDriver"),
  });
  const titleColor = status === "CANCELLED" ? "var(--ink-muted)" : "var(--ink-primary)";
  const clientColor = RIDE_STATUS_TEXT[status];

  const passengerLabel = seats ? `${ride.passengerCount}/${seats}` : `${ride.passengerCount}`;

  const bottomRow = (
    <div className="mt-auto flex min-w-0 items-center gap-[8px] text-[13px]" style={{ color: "var(--ink-body)" }}>
      <span className="flex min-w-0 flex-1 items-center overflow-hidden">
        <span className="shrink-0 font-medium">{time}</span>
        {/* Separator + count hide together below ~170px container width —
            a clipped "40/…" is worse than no count at all. */}
        <span className="flex shrink-0 items-center whitespace-nowrap font-medium @max-[170px]:hidden">
          <span aria-hidden className="shrink-0" style={{ margin: "0 4px" }}>
            ·
          </span>
          {passengerLabel}
        </span>
      </span>
      {driver ? (
        <span className="shrink-0">
          <DriverAvatar driver={driver} size={24} ring decorative />
        </span>
      ) : null}
    </div>
  );

  return (
    <button
      type="button"
      onClick={onClick}
      style={{ ...style, background, containerType: "inline-size" }}
      className="group relative flex w-full min-w-0 cursor-pointer flex-col overflow-hidden rounded-panel text-left transition-[background-color,box-shadow,scale,translate] duration-[.12s] ease-out hover:-translate-y-px hover:shadow-[var(--shadow-card)] active:scale-[0.99] active:translate-y-0 active:shadow-none"
      title={`${clientLabel} · ${route}`}
      aria-label={ariaLabel}
    >
      {/* Darken-on-interaction overlay, layered on top of the status fill
          rather than mixed into it, so the status color never shifts hue —
          only its perceived brightness. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[rgba(20,20,19,0)] transition-colors duration-[.12s] ease-out group-hover:bg-[rgba(20,20,19,.04)] group-active:bg-[rgba(20,20,19,.08)]"
      />

      {/* Wide layout — hidden once the card's own rendered width (not day
          span) drops below ~160px. */}
      <div className="relative flex flex-1 flex-col gap-[6px] px-[14px] py-[12px] @max-[160px]:hidden">
        <div className="flex min-w-0 flex-col gap-[2px]">
          <div className="flex items-start justify-between gap-[6px]">
            <p className="flex min-w-0 items-center gap-[5px] text-[14px] font-semibold" style={{ color: titleColor }}>
              <span className="min-w-0 truncate">{ride.pickupCity}</span>
              {ride.isRoundTrip ? (
                <ArrowLeftRight size={14} strokeWidth={1.75} className="shrink-0" />
              ) : (
                <ArrowRight size={11} strokeWidth={2.2} className="shrink-0" />
              )}
              <span className="min-w-0 truncate">{ride.destinationCity}</span>
            </p>
            <StatusTag status={status} />
          </div>
          <span className="truncate text-[13px]" style={{ color: clientColor }}>
            {clientLabel}
          </span>
        </div>
        {bottomRow}
      </div>

      {/* Compact layout — only shown under ~160px: city codes instead of
          full names. */}
      <div className="relative hidden flex-1 flex-col gap-[6px] p-[12px] @max-[160px]:flex">
        <div className="flex min-w-0 flex-col gap-[2px]">
          <div className="flex items-start justify-between gap-[6px]">
            <p className="min-w-0 truncate text-[14px] font-semibold" style={{ color: titleColor }}>
              {cityCode(ride.pickupCity)} {routeArrow} {cityCode(ride.destinationCity)}
            </p>
            <StatusTag status={status} />
          </div>
          <span className="truncate text-[13px]" style={{ color: clientColor }}>
            {clientLabel}
          </span>
        </div>
        {bottomRow}
      </div>
    </button>
  );
}
