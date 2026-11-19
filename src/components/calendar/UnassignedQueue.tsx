"use client";

import { useTranslations } from "next-intl";
import { clientDisplayName } from "@/lib/clientDisplay";
import { formatShortDateTime } from "@/lib/rideDateFormat";
import { CALENDAR_RESOURCE_COLUMN_WIDTH } from "@/lib/tableLayout";
import type { CalendarRide } from "./types";

export function UnassignedQueue({
  rides,
  onDragStart,
  onDragEnd,
  onRideClick,
}: {
  rides: CalendarRide[];
  onDragStart: (rideId: string) => void;
  onDragEnd: () => void;
  onRideClick: (rideId: string) => void;
}) {
  const t = useTranslations("carrier.calendar");

  // Same two-column layout as the calendar above it: the title sits in a
  // column as wide as the vehicle/driver column, and the ride cards line up
  // under the day columns.
  return (
    <div className="flex border-t border-[var(--border-hairline)] bg-[var(--bg-canvas)]">
      <div
        className="shrink-0 border-r border-[var(--border-hairline)] px-5 py-4"
        style={{ width: CALENDAR_RESOURCE_COLUMN_WIDTH }}
      >
        <h2 className="text-[14px] font-bold text-[var(--ink-primary)]">{t("unassignedTitle")}</h2>
        <p className="text-[12px] text-[var(--ink-muted)] [text-wrap:pretty]">{t("unassignedHint")}</p>
      </div>
      <div className="flex min-w-0 flex-1 flex-wrap content-start gap-[14px] p-4">
        {rides.map((ride) => (
          <div
            key={ride.id}
            role="button"
            tabIndex={0}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = "move";
              onDragStart(ride.id);
            }}
            onDragEnd={onDragEnd}
            onClick={() => onRideClick(ride.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onRideClick(ride.id);
              }
            }}
            className="flex min-w-[190px] flex-1 basis-[210px] cursor-grab flex-col gap-[3px] rounded-control border border-[var(--border-hairline)] bg-[var(--bg-panel)] px-[11px] pb-[10px] pt-[9px] transition-shadow duration-[.12s] ease-out hover:shadow-[var(--shadow-card)] focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)] active:cursor-grabbing"
          >
            <span className="h-1 w-7 shrink-0 rounded-full bg-[var(--accent-due-soon)]" />
            <p className="truncate text-[13px] font-semibold text-[var(--ink-primary)]">
              {ride.pickupCity} → {ride.destinationCity}
            </p>
            <p className="truncate text-[12px] font-semibold text-[var(--ink-2)]">{clientDisplayName(ride.client)}</p>
            <p className="truncate text-[12px] text-[var(--ink-muted)]">
              {formatShortDateTime(new Date(ride.departureAt))} · {ride.passengerCount} {t("pax")}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
