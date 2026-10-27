"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Wrench, Plus } from "lucide-react";
import { RideBlockCard } from "./RideBlockCard";
import { DriverAvatar } from "@/components/ui/DriverAvatar";
import { formatPlate } from "@/lib/plateDisplay";
import { AddVehiclePanel } from "@/components/forms/AddVehiclePanel";
import { AddDriverPanel } from "@/components/forms/AddDriverPanel";
import { CALENDAR_GRID_TEMPLATE } from "@/lib/tableLayout";
import { toDateOnlyString } from "@/lib/pickerDateFormat";
import type { CalendarBlock, CalendarDriver, CalendarRide, CalendarVehicle, ResourceGrouping } from "./types";

// Defaults for a ride created by clicking/dragging an empty calendar cell —
// there's no time-of-day granularity in a day cell to derive these from, so
// a plain business-hours guess stands in until the carrier edits it in the
// form that opens right after.
const CELL_CREATE_DEPARTURE_TIME = "09:00";
const CELL_CREATE_RETURN_TIME = "18:00";

export interface CellRideDraft {
  resourceId: string;
  departureAt: string;
  isRoundTrip: boolean;
  returnAt?: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const GRID_TEMPLATE_COLUMNS = CALENDAR_GRID_TEMPLATE;

export interface DragOverTarget {
  resourceId: string;
  conflict: boolean;
  message?: string;
}

interface Resource {
  id: string;
  name: string;
  plate: string | null;
  seats: number | null;
  avatarColor: string | null;
}

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function dayIndex(weekStart: Date, dateStr: string) {
  const d = startOfDay(new Date(dateStr));
  return Math.round((d.getTime() - weekStart.getTime()) / DAY_MS);
}

// Rides (and blocks) for the same resource that overlap in the days they
// span would otherwise sit exactly on top of each other. Greedily assigns
// each item to the first "lane" whose last item ends before this one
// starts — same interval-graph-coloring approach a day-view calendar uses
// to stack overlapping events side by side instead of overlapping them.
function assignLanes(items: { id: string; startIdx: number; endIdx: number }[]) {
  const laneEnds: number[] = [];
  const laneOf = new Map<string, number>();
  const sorted = [...items].sort((a, b) => a.startIdx - b.startIdx || a.endIdx - b.endIdx);
  for (const item of sorted) {
    let lane = laneEnds.findIndex((end) => end < item.startIdx);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(item.endIdx);
    } else {
      laneEnds[lane] = item.endIdx;
    }
    laneOf.set(item.id, lane);
  }
  return { laneOf, laneCount: Math.max(1, laneEnds.length) };
}

export function ResourceTimelineGrid({
  weekStart,
  grouping,
  vehicles,
  drivers,
  rides,
  blocks,
  onRideClick,
  onDropRide,
  dragOverTarget,
  onDragOverResource,
  onDragLeave,
  draggingRideId,
  onResourceAdded,
  onCreateRide,
}: {
  weekStart: Date;
  grouping: ResourceGrouping;
  vehicles: CalendarVehicle[];
  drivers: CalendarDriver[];
  rides: CalendarRide[];
  blocks: CalendarBlock[];
  onRideClick: (rideId: string) => void;
  onDropRide: (resourceId: string) => void;
  dragOverTarget: DragOverTarget | null;
  onDragOverResource: (resourceId: string) => void;
  onDragLeave: () => void;
  draggingRideId: string | null;
  onResourceAdded: () => void;
  // Clicking (or clicking and dragging across) a resource row's empty day
  // cells starts a new ride for that resource on that date (or date range,
  // for a drag) — see cellSelection below for the gesture itself.
  onCreateRide: (draft: CellRideDraft) => void;
}) {
  const t = useTranslations("carrier.calendar");
  const tCarrier = useTranslations("carrier");
  const tType = useTranslations("vehicleType");
  const locale = useLocale();
  // The in-progress cell click/drag — set on mousedown over an empty cell,
  // extended on mouseenter while the button stays down (same resource row
  // only), and resolved into an onCreateRide call on mouseup anywhere.
  // Window-level mouseup (not a per-cell handler) so releasing outside any
  // cell — or outside the grid entirely — still ends the gesture cleanly.
  const [cellSelection, setCellSelection] = useState<{ resourceId: string; startIdx: number; endIdx: number } | null>(
    null,
  );

  useEffect(() => {
    if (!cellSelection) return;
    function finish() {
      if (!cellSelection) return;
      const startIdx = Math.min(cellSelection.startIdx, cellSelection.endIdx);
      const endIdx = Math.max(cellSelection.startIdx, cellSelection.endIdx);
      const departureDay = new Date(weekStart.getTime() + startIdx * DAY_MS);
      const isRoundTrip = endIdx > startIdx;
      const draft: CellRideDraft = {
        resourceId: cellSelection.resourceId,
        departureAt: `${toDateOnlyString(departureDay)}T${CELL_CREATE_DEPARTURE_TIME}`,
        isRoundTrip,
      };
      if (isRoundTrip) {
        const returnDay = new Date(weekStart.getTime() + endIdx * DAY_MS);
        draft.returnAt = `${toDateOnlyString(returnDay)}T${CELL_CREATE_RETURN_TIME}`;
      }
      onCreateRide(draft);
      setCellSelection(null);
    }
    window.addEventListener("mouseup", finish);
    return () => window.removeEventListener("mouseup", finish);
  }, [cellSelection, weekStart, onCreateRide]);
  // sr's default Intl formatting is Cyrillic; the rest of this app's
  // Serbian copy is Latin, so map to the Latin variant like the DatePicker
  // already does (see src/lib/pickerDateFormat.ts).
  const intlLocale = locale === "sr" ? "sr-Latn" : "en";
  const [addingResource, setAddingResource] = useState(false);
  const today = startOfDay(new Date());
  const days = Array.from({ length: 7 }, (_, i) => new Date(weekStart.getTime() + i * DAY_MS));

  const resources: Resource[] =
    grouping === "vehicle"
      ? vehicles.map((v) => ({
          id: v.id,
          name: `${tType(v.type)} ${v.model}`,
          plate: v.licensePlate,
          seats: v.seats,
          avatarColor: null,
        }))
      : drivers.map((d) => ({ id: d.id, name: d.name, plate: null, seats: null, avatarColor: d.avatarColor ?? null }));

  const resourceCountLabel =
    grouping === "vehicle"
      ? t("vehicleCount", { count: vehicles.length })
      : t("driverCount", { count: drivers.length });

  function driverFor(ride: CalendarRide) {
    return ride.driverId ? drivers.find((d) => d.id === ride.driverId) : undefined;
  }
  function seatsFor(ride: CalendarRide) {
    return ride.vehicleId ? vehicles.find((v) => v.id === ride.vehicleId)?.seats ?? null : null;
  }

  return (
    <>
      {/* No overflow/scroll declared here — the parent (RidesCalendar) owns
          the single scroll container for both axes, which is what lets the
          sticky header (top) and sticky resource column (left) below both
          resolve against the same scrolling ancestor. */}
      <div className="min-w-full">
        <div className="sticky top-0 z-20 grid" style={{ gridTemplateColumns: GRID_TEMPLATE_COLUMNS }}>
            <div
              className="sticky left-0 z-30 flex items-center border-r bg-white px-[14px] py-4 text-[13px] text-[var(--ink-secondary)]"
              style={{ borderRightColor: "#F1F1EE", borderBottomColor: "#EFEFEC", borderBottomWidth: 1 }}
            >
              {resources.length > 0 ? resourceCountLabel : ""}
            </div>
            {days.map((day, i) => {
              const weekday = day.toLocaleDateString(intlLocale, { weekday: "short" });
              const dateNum = day.getDate();
              return (
                <div
                  key={i}
                  className="flex items-center gap-[6px] border-r bg-white px-[14px] py-4 last:border-r-0"
                  style={{ borderRightColor: "#F1F1EE", borderBottomColor: "#EFEFEC", borderBottomWidth: 1 }}
                >
                  <span className="text-[14px]" style={{ color: "#6E6E68" }}>
                    {weekday}
                  </span>
                  <span className="text-[14px] font-semibold" style={{ color: "#1B1B19" }}>
                    {dateNum}
                  </span>
                </div>
              );
            })}
          </div>

          {resources.length === 0 ? (
            <p className="p-6 text-center text-[13.5px] text-[var(--ink-secondary)]">
              {grouping === "vehicle" ? t("noVehicles") : t("noDrivers")}
            </p>
          ) : (
            resources.map((resource, resourceIndex) => {
              const isLastResource = resourceIndex === resources.length - 1;
              const resourceRides = rides
                .filter((r) => (grouping === "vehicle" ? r.vehicleId : r.driverId) === resource.id)
                .map((ride) => {
                  const startIdx = Math.max(0, dayIndex(weekStart, ride.departureAt));
                  const endIdx = ride.returnAt ? Math.min(6, dayIndex(weekStart, ride.returnAt)) : startIdx;
                  return { ride, startIdx, endIdx };
                });
              const resourceBlocks = blocks
                .filter((b) => (grouping === "vehicle" ? b.vehicleId : b.driverId) === resource.id)
                .map((block) => ({
                  block,
                  startIdx: Math.max(0, dayIndex(weekStart, block.startAt)),
                  endIdx: Math.min(6, dayIndex(weekStart, block.endAt)),
                }));
              const isDragTarget = dragOverTarget?.resourceId === resource.id;

              // Overlapping rides/blocks for this resource get their own lane
              // (row) instead of sitting on top of each other.
              const { laneOf, laneCount } = assignLanes([
                ...resourceRides.map(({ ride, startIdx, endIdx }) => ({ id: ride.id, startIdx, endIdx })),
                ...resourceBlocks.map(({ block, startIdx, endIdx }) => ({ id: block.id, startIdx, endIdx })),
              ]);

              return (
                <div
                  key={resource.id}
                  className="grid"
                  style={{
                    gridTemplateColumns: GRID_TEMPLATE_COLUMNS,
                    borderBottom: isLastResource ? undefined : "1px solid #EFEFEC",
                  }}
                >
                  <div
                    className="sticky left-0 z-10 flex min-h-[132px] items-center gap-[10px] border-r bg-white px-5 py-[18px]"
                    style={{ borderRightColor: "#F1F1EE" }}
                  >
                    {grouping === "driver" ? (
                      <DriverAvatar
                        driver={{ id: resource.id, name: resource.name, avatarColor: resource.avatarColor }}
                        size={40}
                        decorative
                      />
                    ) : null}
                    <div className="min-w-0 flex-1">
                      <p
                        className="line-clamp-2 text-[14.5px] font-semibold"
                        style={{ color: "#141413", lineHeight: 1.3 }}
                      >
                        {resource.name}
                      </p>
                      {resource.plate || resource.seats ? (
                        <p className="truncate text-[12.5px]" style={{ color: "#6E6E68" }}>
                          {resource.plate ? <span className="font-mono text-[12px]">{formatPlate(resource.plate)}</span> : null}
                          {resource.plate && resource.seats ? " · " : ""}
                          {resource.seats ? `${resource.seats} ${tCarrier("fleetTable.seatsShort")}` : ""}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <div
                    className="relative col-span-7 grid"
                    style={{
                      gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
                      gridTemplateRows: `repeat(${laneCount}, minmax(132px, auto))`,
                    }}
                    onDragOver={(e) => {
                      if (!draggingRideId) return;
                      e.preventDefault();
                      onDragOverResource(resource.id);
                    }}
                    onDragLeave={onDragLeave}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (draggingRideId) onDropRide(resource.id);
                    }}
                  >
                    {days.map((day, i) => {
                      const isToday = day.getTime() === today.getTime();
                      const inSelection =
                        cellSelection?.resourceId === resource.id &&
                        i >= Math.min(cellSelection.startIdx, cellSelection.endIdx) &&
                        i <= Math.max(cellSelection.startIdx, cellSelection.endIdx);
                      return (
                        <div
                          key={i}
                          title={t("createRideOnDay")}
                          onMouseDown={(e) => {
                            // Left click only, and only on the empty cell
                            // itself — a ride/block sitting in a different
                            // lane on this same day still leaves the rest
                            // of the cell clickable underneath it.
                            if (e.button !== 0) return;
                            e.preventDefault();
                            setCellSelection({ resourceId: resource.id, startIdx: i, endIdx: i });
                          }}
                          onMouseEnter={() => {
                            // Dragging only extends within the row it
                            // started on — entering a different resource's
                            // cells while the button is held is ignored.
                            setCellSelection((prev) => (prev && prev.resourceId === resource.id ? { ...prev, endIdx: i } : prev));
                          }}
                          className={`cursor-pointer select-none border-r transition-colors duration-[.1s] ease-out last:border-r-0 ${
                            inSelection
                              ? "bg-[var(--action-100)]"
                              : isDragTarget
                                ? dragOverTarget?.conflict
                                  ? "bg-[var(--chip-critical)]/30"
                                  : "bg-[var(--chip-positive)]/30"
                                : isToday
                                  ? "bg-[var(--bg-today)] hover:bg-[var(--action-100)]/60"
                                  : "bg-white hover:bg-[var(--action-100)]/40"
                          }`}
                          style={{ gridRow: "1 / -1", gridColumn: i + 1, borderRightColor: "#F1F1EE" }}
                        />
                      );
                    })}

                    {resourceBlocks.map(({ block, startIdx, endIdx }) => (
                      <div
                        key={block.id}
                        className="z-0 flex h-10 items-center gap-[6px] truncate rounded-[9px] px-[10px] text-[13.5px] font-medium"
                        style={{
                          gridRow: (laneOf.get(block.id) ?? 0) + 1,
                          gridColumn: `${startIdx + 1} / ${endIdx + 2}`,
                          margin: "12px 8px",
                          background: "var(--status-blocked-bg)",
                          color: "#3B1F87",
                          alignSelf: "start",
                        }}
                        title={block.note ?? undefined}
                      >
                        <Wrench size={14} strokeWidth={1.9} className="shrink-0" />
                        <span className="truncate">{t(`blockReason.${block.reason}`)}</span>
                      </div>
                    ))}

                    {resourceRides.map(({ ride, startIdx, endIdx }) => (
                      <div
                        key={ride.id}
                        className="z-10"
                        style={{
                          gridRow: (laneOf.get(ride.id) ?? 0) + 1,
                          gridColumn: `${startIdx + 1} / ${endIdx + 2}`,
                          margin: "9px",
                        }}
                      >
                        <RideBlockCard
                          ride={ride}
                          onClick={() => onRideClick(ride.id)}
                          style={{ height: "100%" }}
                          seats={seatsFor(ride)}
                          driver={driverFor(ride)}
                        />
                      </div>
                    ))}

                    {isDragTarget && dragOverTarget?.conflict && dragOverTarget.message ? (
                      <div
                        className="z-20 flex items-center rounded-[10px] px-2 py-1 text-[12.5px] font-semibold text-white"
                        style={{
                          gridRow: 1,
                          gridColumn: "1 / 8",
                          margin: "6px",
                          justifySelf: "start",
                          background: "var(--ink-destructive)",
                        }}
                      >
                        {dragOverTarget.message}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}

          <button
            type="button"
            onClick={() => setAddingResource(true)}
            className="flex h-12 w-full items-center gap-[6px] border-t px-5 text-[13.5px] font-medium text-[var(--ink-secondary)] transition-colors duration-[.12s] ease-out hover:bg-[var(--border-soft)]"
            style={{ borderTopColor: "#EFEFEC" }}
          >
            <Plus size={14} strokeWidth={1.9} />
            {grouping === "vehicle" ? tCarrier("addVehicle") : tCarrier("addDriver")}
          </button>
        </div>
      {addingResource && grouping === "vehicle" ? (
        <AddVehiclePanel
          onClose={() => setAddingResource(false)}
          onCreated={() => {
            setAddingResource(false);
            onResourceAdded();
          }}
        />
      ) : null}
      {addingResource && grouping === "driver" ? (
        <AddDriverPanel
          vehicles={vehicles}
          onClose={() => setAddingResource(false)}
          onCreated={() => {
            setAddingResource(false);
            onResourceAdded();
          }}
        />
      ) : null}
    </>
  );
}
