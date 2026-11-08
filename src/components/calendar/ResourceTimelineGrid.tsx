"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Wrench, Plus } from "lucide-react";
import { RideBlockCard } from "./RideBlockCard";
import { DriverAvatar } from "@/components/ui/DriverAvatar";
import { formatPlate } from "@/lib/plateDisplay";
import { AddVehiclePanel } from "@/components/forms/AddVehiclePanel";
import { AddDriverPanel } from "@/components/forms/AddDriverPanel";
import { CALENDAR_DAY_COLUMN_MIN_WIDTH, CALENDAR_RESOURCE_COLUMN_WIDTH } from "@/lib/tableLayout";
import { toDateOnlyString } from "@/lib/pickerDateFormat";
import type { CalendarBlock, CalendarDriver, CalendarRide, CalendarVehicle, CalendarView, ResourceGrouping } from "./types";

// Defaults for a ride created by clicking/dragging an empty day cell (the
// week view, and the month grid's day cells) — there's no time-of-day
// granularity in a day cell to derive these from, so a plain business-hours
// guess stands in until the carrier edits it in the form that opens right
// after. The day view's hour cells use the hour itself instead.
export const CELL_CREATE_DEPARTURE_TIME = "09:00";
export const CELL_CREATE_RETURN_TIME = "18:00";

export interface CellRideDraft {
  // The row it was created on; absent from the month grid, which has none.
  resourceId?: string;
  departureAt: string;
  isRoundTrip: boolean;
  returnAt?: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;
// The day view lays rides out on quarter-hour slots (four per hour column),
// so a 08:00–14:00 ride and a 19:30 one sit at their real times with the
// gap between them visible.
const SLOT_MS = 15 * 60 * 1000;
const SLOTS_PER_HOUR = 4;
const DAY_SLOTS = 24 * SLOTS_PER_HOUR;
// How long a one-way ride (no return time) is drawn in the day view —
// matches AVERAGE_TRIP_DURATION in lib/availability.ts.
const ONE_WAY_SPAN_MS = 4 * 60 * 60 * 1000;

// The month view is its own grid (MonthGrid); this timeline draws the day
// and week views.
type TimelineView = Exclude<CalendarView, "month">;

// Per view: narrowest a column may get before the grid scrolls sideways
// (an hour / a day), and the height of one lane of rides.
const COLUMN_MIN_WIDTH: Record<TimelineView, number> = { day: 64, week: CALENDAR_DAY_COLUMN_MIN_WIDTH };
const LANE_MIN_HEIGHT: Record<TimelineView, number> = { day: 112, week: 132 };

const pad2 = (n: number) => String(n).padStart(2, "0");

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

function dayIndex(rangeStart: Date, dateStr: string) {
  const d = startOfDay(new Date(dateStr));
  return Math.round((d.getTime() - rangeStart.getTime()) / DAY_MS);
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
  view,
  days,
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
  view: TimelineView;
  // The visible days, local midnights: one for the day view, seven for the
  // week.
  days: Date[];
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
      const isRoundTrip = endIdx > startIdx;
      let draft: CellRideDraft;
      if (view === "day") {
        // Hour cells: the ride starts at the hour clicked; dragging across
        // hours makes it a same-day round trip back by the end of the last.
        const date = toDateOnlyString(days[0]);
        draft = { resourceId: cellSelection.resourceId, departureAt: `${date}T${pad2(startIdx)}:00`, isRoundTrip };
        if (isRoundTrip) draft.returnAt = `${date}T${endIdx === 23 ? "23:45" : `${pad2(endIdx + 1)}:00`}`;
      } else {
        draft = {
          resourceId: cellSelection.resourceId,
          departureAt: `${toDateOnlyString(days[startIdx])}T${CELL_CREATE_DEPARTURE_TIME}`,
          isRoundTrip,
        };
        if (isRoundTrip) draft.returnAt = `${toDateOnlyString(days[endIdx])}T${CELL_CREATE_RETURN_TIME}`;
      }
      onCreateRide(draft);
      setCellSelection(null);
    }
    window.addEventListener("mouseup", finish);
    return () => window.removeEventListener("mouseup", finish);
  }, [cellSelection, days, view, onCreateRide]);
  // sr's default Intl formatting is Cyrillic; the rest of this app's
  // Serbian copy is Latin, so map to the Latin variant like the DatePicker
  // already does (see src/lib/pickerDateFormat.ts).
  const intlLocale = locale === "sr" ? "sr-Latn" : "en";
  const [addingResource, setAddingResource] = useState(false);
  const now = new Date();
  const today = startOfDay(now);
  const rangeStart = days[0];
  const isDayView = view === "day";
  // Header/cell columns: hours in the day view, days otherwise.
  const columnCount = isDayView ? 24 : days.length;
  const lastIdx = (isDayView ? DAY_SLOTS : days.length) - 1;
  const gridTemplate = `${CALENDAR_RESOURCE_COLUMN_WIDTH}px repeat(${columnCount}, minmax(${COLUMN_MIN_WIDTH[view]}px, 1fr))`;
  const dayStartMs = rangeStart.getTime();
  const toSlot = (ms: number) => Math.floor((ms - dayStartMs) / SLOT_MS);
  // Start/end column of an item on this view's grid (days, or quarter-hour
  // slots in the day view), clamped to what's visible; null when it falls
  // entirely outside the range.
  function placement(startStr: string, endStr: string | null, oneWay: boolean) {
    if (isDayView) {
      const start = new Date(startStr).getTime();
      const end = endStr ? new Date(endStr).getTime() : start + (oneWay ? ONE_WAY_SPAN_MS : 0);
      if (end <= dayStartMs || start >= dayStartMs + DAY_MS) return null;
      const startIdx = Math.max(0, toSlot(start));
      const endIdx = Math.min(lastIdx, Math.max(startIdx, Math.ceil((end - dayStartMs) / SLOT_MS) - 1));
      return { startIdx, endIdx };
    }
    const rawStart = dayIndex(rangeStart, startStr);
    const rawEnd = endStr ? dayIndex(rangeStart, endStr) : rawStart;
    if (rawEnd < 0 || rawStart > lastIdx) return null;
    return { startIdx: Math.max(0, rawStart), endIdx: Math.min(lastIdx, rawEnd) };
  }
  const showNowLine = isDayView && today.getTime() === rangeStart.getTime();
  const nowSlot = toSlot(now.getTime());

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
      {/* At least the scroller's width, and wide enough for every column at
          its minimum — so row lines and the add row run the full width when
          the day view's hour grid scrolls sideways. */}
      <div style={{ minWidth: `max(100%, ${CALENDAR_RESOURCE_COLUMN_WIDTH + columnCount * COLUMN_MIN_WIDTH[view]}px)` }}>
        <div className="sticky top-0 z-20 grid" style={{ gridTemplateColumns: gridTemplate }}>
            <div
              className="sticky left-0 z-30 flex items-center border-r bg-white px-[14px] py-4 text-[13px] text-[var(--ink-secondary)]"
              style={{ borderRightColor: "#F1F1EE", borderBottomColor: "#EFEFEC", borderBottomWidth: 1 }}
            >
              {resources.length > 0 ? resourceCountLabel : ""}
            </div>
            {isDayView
              ? Array.from({ length: 24 }, (_, hour) => (
                  <div
                    key={hour}
                    data-hour={hour}
                    className="flex items-center border-r bg-white px-[10px] py-4 last:border-r-0"
                    style={{ borderRightColor: "#F1F1EE", borderBottomColor: "#EFEFEC", borderBottomWidth: 1 }}
                  >
                    <span
                      className={`text-[13px] tabular-nums ${showNowLine && now.getHours() === hour ? "font-semibold" : ""}`}
                      style={{ color: showNowLine && now.getHours() === hour ? "var(--action-bg)" : "#6E6E68" }}
                    >
                      {pad2(hour)}:00
                    </span>
                  </div>
                ))
              : days.map((day, i) => {
                  const weekday = day.toLocaleDateString(intlLocale, { weekday: "short" });
                  const isToday = day.getTime() === today.getTime();
                  return (
                    <div
                      key={i}
                      className="flex items-center gap-[6px] border-r bg-white px-[14px] py-4 last:border-r-0"
                      style={{ borderRightColor: "#F1F1EE", borderBottomColor: "#EFEFEC", borderBottomWidth: 1 }}
                    >
                      <span className="text-[14px]" style={{ color: "#6E6E68" }}>
                        {weekday}
                      </span>
                      <span
                        className={`text-[14px] font-semibold ${
                          isToday ? "flex h-[24px] min-w-[24px] items-center justify-center rounded-full px-[5px]" : ""
                        }`}
                        style={isToday ? { background: "var(--action-bg)", color: "#fff" } : { color: "#1B1B19" }}
                      >
                        {day.getDate()}
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
              // Clamp to the visible range only what actually overlaps it — a
              // ride or block entirely before (or after) the range must not
              // be pinned onto the first (or last) column.
              const resourceRides = rides
                .filter((r) => (grouping === "vehicle" ? r.vehicleId : r.driverId) === resource.id)
                .flatMap((ride) => {
                  const at = placement(ride.departureAt, ride.returnAt, true);
                  return at ? [{ ride, ...at }] : [];
                });
              const resourceBlocks = blocks
                .filter((b) => (grouping === "vehicle" ? b.vehicleId : b.driverId) === resource.id)
                .flatMap((block) => {
                  const at = placement(block.startAt, block.endAt, false);
                  return at ? [{ block, ...at }] : [];
                });
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
                    gridTemplateColumns: gridTemplate,
                    borderBottom: isLastResource ? undefined : "1px solid #EFEFEC",
                  }}
                >
                  <div
                    className="sticky left-0 z-[25] flex items-center gap-[10px] border-r bg-white px-5 py-[18px]"
                    style={{ borderRightColor: "#F1F1EE", minHeight: LANE_MIN_HEIGHT[view] }}
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
                    className="relative grid"
                    style={{
                      gridColumn: "2 / -1",
                      gridTemplateColumns: `repeat(${lastIdx + 1}, minmax(0, 1fr))`,
                      gridTemplateRows: `repeat(${laneCount}, minmax(${LANE_MIN_HEIGHT[view]}px, auto))`,
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
                    {Array.from({ length: columnCount }, (_, i) => {
                      const isToday = isDayView
                        ? showNowLine && now.getHours() === i
                        : days[i].getTime() === today.getTime();
                      const inSelection =
                        cellSelection?.resourceId === resource.id &&
                        i >= Math.min(cellSelection.startIdx, cellSelection.endIdx) &&
                        i <= Math.max(cellSelection.startIdx, cellSelection.endIdx);
                      return (
                        <div
                          key={i}
                          title={isDayView ? t("createRideAtTime") : t("createRideOnDay")}
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
                          style={{
                            gridRow: "1 / -1",
                            gridColumn: isDayView ? `${i * SLOTS_PER_HOUR + 1} / span ${SLOTS_PER_HOUR}` : i + 1,
                            borderRightColor: "#F1F1EE",
                          }}
                        />
                      );
                    })}

                    {showNowLine && nowSlot >= 0 && nowSlot <= lastIdx ? (
                      <div
                        aria-hidden
                        className="pointer-events-none z-[15] w-[2px] rounded-full"
                        style={{
                          gridRow: "1 / -1",
                          gridColumn: nowSlot + 1,
                          justifySelf: "start",
                          marginLeft: `${(((now.getTime() - dayStartMs) % SLOT_MS) / SLOT_MS) * 100}%`,
                          background: "var(--action-bg)",
                        }}
                      />
                    ) : null}

                    {resourceBlocks.map(({ block, startIdx, endIdx }) => (
                      <div
                        key={block.id}
                        className="z-0 flex h-10 items-center gap-[6px] truncate rounded-[9px] px-[10px] text-[13.5px] font-medium"
                        style={{
                          gridRow: (laneOf.get(block.id) ?? 0) + 1,
                          gridColumn: `${startIdx + 1} / ${endIdx + 2}`,
                          margin: view === "week" ? "12px 8px" : "12px 3px",
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
                        className="z-10 min-w-0"
                        style={{
                          gridRow: (laneOf.get(ride.id) ?? 0) + 1,
                          gridColumn: `${startIdx + 1} / ${endIdx + 2}`,
                          margin: view === "week" ? "9px" : "9px 3px",
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
                          gridColumn: "1 / -1",
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
            className="sticky left-0 flex h-12 w-[100cqw] items-center gap-[6px] border-t px-5 text-[13.5px] font-medium text-[var(--ink-secondary)] transition-colors duration-[.12s] ease-out hover:bg-[var(--border-soft)]"
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
