"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, Bus, UserRound } from "lucide-react";
import {
  ResourceTimelineGrid,
  CELL_CREATE_DEPARTURE_TIME,
  type DragOverTarget,
  type CellRideDraft,
} from "./ResourceTimelineGrid";
import { MonthGrid } from "./MonthGrid";
import { UnassignedQueue } from "./UnassignedQueue";
import { NewRideModal, type NewRideInitialValues } from "./NewRideModal";
import { RideDetailDrawer } from "./RideDetailDrawer";
import { useNewRide } from "./NewRideContext";
import { MultiSelectFilter, type MultiSelectOption } from "@/components/carrier/MultiSelectFilter";
import { RIDE_STATUS_DOT } from "./statusStyles";
import { usePathname, useRouter } from "@/i18n/navigation";
import { fetchWithAvailabilityConfirm } from "@/lib/availabilityConfirm";
import { useAvailabilityConfirmDialog } from "@/lib/useAvailabilityConfirmDialog";
import { clientDisplayName } from "@/lib/clientDisplay";
import { displayRideStatus } from "@/lib/rideStatus";
import { CALENDAR_RESOURCE_COLUMN_WIDTH } from "@/lib/tableLayout";
import { toDateOnlyString } from "@/lib/pickerDateFormat";
import { parseStatusParam, serializeStatusParam } from "@/lib/statusFilterParam";
import type { CalendarData, CalendarRide, CalendarView, ResourceGrouping, RideStatus } from "./types";

const STATUSES: RideStatus[] = ["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED"];

const AVERAGE_TRIP_DURATION_HOURS = 4;

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfWeek(date: Date) {
  const d = startOfDay(date);
  const day = d.getDay();
  // Monday-start week
  d.setDate(d.getDate() + ((day === 0 ? -6 : 1) - day));
  return d;
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

const VIEWS: CalendarView[] = ["day", "week", "month"];
const VIEW_STORAGE_KEY = "travia.calendarView";

// The visible days (local midnights, built with setDate so a DST change
// inside the range can't shift a day) for the view around `anchor`. The
// range sent to the server runs from the first day's midnight to the
// midnight after the last.
function viewDays(view: CalendarView, anchor: Date): Date[] {
  if (view === "day") return [startOfDay(anchor)];
  if (view === "week") {
    const monday = startOfWeek(anchor);
    return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  }
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const count = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate();
  return Array.from({ length: count }, (_, i) => addDays(first, i));
}

// Prev/next: a day, a week, or a calendar month (from the 1st, so stepping
// from 31 Jan doesn't skip February).
function stepAnchor(view: CalendarView, anchor: Date, direction: 1 | -1) {
  if (view === "day") return addDays(anchor, direction);
  if (view === "week") return addDays(anchor, 7 * direction);
  return new Date(anchor.getFullYear(), anchor.getMonth() + direction, 1);
}

function cellRideDraftInitialValues(draft: CellRideDraft, grouping: ResourceGrouping): NewRideInitialValues {
  return {
    departureAt: draft.departureAt,
    isRoundTrip: draft.isRoundTrip,
    returnAt: draft.returnAt,
    ...(draft.resourceId ? (grouping === "vehicle" ? { vehicleId: draft.resourceId } : { driverId: draft.resourceId }) : {}),
  };
}

function rideWindow(ride: Pick<CalendarRide, "departureAt" | "returnAt">) {
  const start = new Date(ride.departureAt);
  const end = ride.returnAt
    ? new Date(ride.returnAt)
    : new Date(start.getTime() + AVERAGE_TRIP_DURATION_HOURS * 60 * 60 * 1000);
  return { start, end };
}

function windowsOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  const pad = 3 * 60 * 60 * 1000;
  return aStart.getTime() - pad <= bEnd.getTime() && aEnd.getTime() + pad >= bStart.getTime();
}

// Prev/next/date live in one bordered segmented control; the arrows get a
// hover tint only (no border of their own — the shared control draws it).
// Every toolbar control is exactly 40px tall.
const WEEK_ARROW_CLASS =
  "flex h-full w-10 shrink-0 items-center justify-center text-[var(--ink-secondary)] transition-colors duration-[.12s] ease-out hover:bg-[var(--border-soft)]";
const TODAY_BUTTON_CLASS =
  "flex h-10 shrink-0 items-center rounded-[10px] bg-[var(--border-soft)] px-3 text-[13.5px] font-semibold text-[var(--ink-primary)] transition-colors duration-[.12s] ease-out hover:bg-[var(--border-control)]";

export function RidesCalendar() {
  const t = useTranslations("carrier.calendar");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  // sr's default Intl formatting is Cyrillic; the rest of this app's
  // Serbian copy is Latin.
  const intlLocale = locale === "sr" ? "sr-Latn" : "en";
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [view, setView] = useState<CalendarView>("week");
  // Any date inside the visible range; the range itself comes from the view.
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()));
  const days = useMemo(() => viewDays(view, anchor), [view, anchor]);
  const rangeStart = days[0];
  const rangeEnd = addDays(days[days.length - 1], 1);
  const rangeKey = `${rangeStart.toISOString()}|${rangeEnd.toISOString()}`;
  const scrollRef = useRef<HTMLDivElement>(null);
  const [grouping, setGrouping] = useState<ResourceGrouping>("vehicle");
  const [statusFilter, setStatusFilter] = useState<string[]>(() =>
    parseStatusParam(searchParams.get("status"), STATUSES),
  );
  const [data, setData] = useState<CalendarData | null>(null);
  const [loading, setLoading] = useState(true);
  const { showNewRide, closeNewRide } = useNewRide();
  const { confirm: confirmAvailability, dialog: availabilityDialog } = useAvailabilityConfirmDialog();
  const [selectedRideId, setSelectedRideId] = useState<string | null>(null);
  const [draggingRideId, setDraggingRideId] = useState<string | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<DragOverTarget | null>(null);
  // Set by clicking (or click-dragging across) an empty calendar cell —
  // opens the same "+ New Ride" form, prefilled with that date range and
  // resource. See ResourceTimelineGrid's onCreateRide.
  const [cellRideDraft, setCellRideDraft] = useState<CellRideDraft | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    // Plain fetch() has no built-in timeout — if the server hangs (a slow
    // query, an exhausted DB connection pool) the request would otherwise
    // sit forever with no error and no feedback, leaving the page stuck on
    // "Loading…" indefinitely. Aborting after a bound turns that into a
    // visible, retryable error instead.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      const [start, end] = rangeKey.split("|");
      const params = new URLSearchParams({ start, end });
      const res = await fetch(`/api/carrier/calendar?${params}`, { signal: controller.signal });
      if (res.ok) {
        setData(await res.json());
      } else {
        console.error("Failed to load calendar", res.status, await res.text().catch(() => ""));
      }
    } catch (err) {
      console.error("Failed to load calendar", err);
    } finally {
      clearTimeout(timeout);
      setLoading(false);
    }
  }, [rangeKey]);

  // The chosen view is remembered per browser. Read after mount (not in the
  // useState initializer) so the server-rendered markup matches the first
  // client render.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(VIEW_STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved && (VIEWS as string[]).includes(saved)) setView(saved as CalendarView);
    } catch {
      // Storage blocked (private mode etc.) — just start on the week view.
    }
  }, []);

  function changeView(next: CalendarView) {
    setView(next);
    try {
      window.localStorage.setItem(VIEW_STORAGE_KEY, next);
    } catch {
      // Not remembered this time — the view still switches.
    }
  }

  // The day view opens scrolled to 06:00 (the hours before stay a scroll
  // away); the week and month views always start at the left edge.
  const hasData = data !== null;
  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller || !hasData) return;
    const six = view === "day" ? scroller.querySelector<HTMLElement>('[data-hour="6"]') : null;
    scroller.scrollLeft = six ? six.offsetLeft - CALENDAR_RESOURCE_COLUMN_WIDTH : 0;
  }, [view, rangeKey, hasData]);

  useEffect(() => {
    // Standard fetch-on-mount/on-dependency-change — load() only touches
    // state after its await resolves. No data-fetching library elsewhere
    // in this app to reach for instead.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const allRides = useMemo(() => (data ? [...data.rides, ...data.unassigned] : []), [data]);
  const statusOptions: MultiSelectOption[] = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const status of STATUSES) counts[status] = 0;
    for (const ride of data?.rides ?? []) {
      const status = displayRideStatus(ride);
      counts[status] = (counts[status] ?? 0) + 1;
    }
    return STATUSES.map((status) => ({
      value: status,
      label: t(`legend.${status}`),
      count: counts[status] ?? 0,
      dotColor: RIDE_STATUS_DOT[status],
    }));
  }, [data, t]);
  const filteredRides = useMemo(
    () =>
      statusFilter.length > 0
        ? (data?.rides ?? []).filter((r) => statusFilter.includes(displayRideStatus(r)))
        : (data?.rides ?? []),
    [data, statusFilter],
  );

  function updateStatusFilter(values: string[]) {
    setStatusFilter(values);
    const params = new URLSearchParams(searchParams);
    if (values.length > 0) params.set("status", serializeStatusParam(values));
    else params.delete("status");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }
  const draggingRide = draggingRideId ? allRides.find((r) => r.id === draggingRideId) ?? null : null;
  const selectedRide = selectedRideId ? allRides.find((r) => r.id === selectedRideId) ?? null : null;

  function handleDragOverResource(resourceId: string) {
    if (!draggingRide || !data) return;
    const { start, end } = rideWindow(draggingRide);

    const resourceRides = data.rides.filter(
      (r) => r.id !== draggingRide.id && (grouping === "vehicle" ? r.vehicleId : r.driverId) === resourceId,
    );
    const conflictRide = resourceRides.find((r) => {
      const w = rideWindow(r);
      return windowsOverlap(start, end, w.start, w.end);
    });
    if (conflictRide) {
      setDragOverTarget({
        resourceId,
        conflict: true,
        message: t("conflictWith", { client: clientDisplayName(conflictRide.client) }),
      });
      return;
    }

    const resourceBlocks = data.blocks.filter(
      (b) => (grouping === "vehicle" ? b.vehicleId : b.driverId) === resourceId,
    );
    const conflictBlock = resourceBlocks.find((b) =>
      windowsOverlap(start, end, new Date(b.startAt), new Date(b.endAt)),
    );
    if (conflictBlock) {
      setDragOverTarget({ resourceId, conflict: true, message: t("conflictBlocked") });
      return;
    }

    setDragOverTarget({ resourceId, conflict: false });
  }

  async function handleDrop(resourceId: string) {
    if (!draggingRide) return;
    const body = grouping === "vehicle" ? { vehicleId: resourceId } : { driverId: resourceId };
    setDraggingRideId(null);
    setDragOverTarget(null);
    // The red highlight while dragging is just a live preview — dropping
    // still goes through, and a real conflict is confirmed (not blocked)
    // via the server's advisory check.
    const { response } = await fetchWithAvailabilityConfirm(
      `/api/carrier/rides/${draggingRide.id}/assign`,
      "POST",
      body,
      (start, end) => t("availabilityWarning", { start, end }),
      confirmAvailability,
    );
    if (response.ok) load();
  }

  if (loading && !data) {
    return <p className="text-[13.5px] text-[var(--ink-secondary)]">{t("loading")}</p>;
  }
  if (!data) {
    return (
      <p className="flex items-center gap-2 text-[13.5px] text-[var(--ink-destructive)]">
        {t("loadError")}
        <button type="button" onClick={load} className="font-semibold underline underline-offset-2">
          {tCommon("retry")}
        </button>
      </p>
    );
  }

  const lastDay = days[days.length - 1];
  const fmtDay = (d: Date) => new Intl.DateTimeFormat(intlLocale, { day: "numeric", month: "short" }).format(d);
  const rangeLabel =
    view === "day"
      ? new Intl.DateTimeFormat(intlLocale, { weekday: "short", day: "numeric", month: "short", year: "numeric" }).format(rangeStart)
      : view === "week"
        ? `${fmtDay(rangeStart)} – ${fmtDay(lastDay)} ${lastDay.getFullYear()}`
        : new Intl.DateTimeFormat(intlLocale, { month: "long", year: "numeric" }).format(rangeStart);
  const previousLabel = view === "day" ? t("previousDay") : view === "week" ? t("previousWeek") : t("previousMonth");
  const nextLabel = view === "day" ? t("nextDay") : view === "week" ? t("nextWeek") : t("nextMonth");

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[14px] bg-[var(--surface-card-bg)] shadow-[var(--shadow-surface-card)]">
      <div className="flex shrink-0 items-center gap-2 p-4">
        <div
          className="flex h-10 shrink-0 items-center overflow-hidden rounded-[10px]"
          style={{ boxShadow: "inset 0 0 0 1px var(--border-control)" }}
        >
          <button
            type="button"
            onClick={() => setAnchor(stepAnchor(view, anchor, -1))}
            aria-label={previousLabel}
            className={WEEK_ARROW_CLASS}
          >
            <ChevronLeft size={16} strokeWidth={1.9} />
          </button>
          <span
            className="flex h-full items-center whitespace-nowrap px-3 text-[14px] font-semibold text-[var(--ink-primary)]"
            style={{ borderLeft: "1px solid var(--border-control)", borderRight: "1px solid var(--border-control)" }}
          >
            {rangeLabel}
          </span>
          <button
            type="button"
            onClick={() => setAnchor(stepAnchor(view, anchor, 1))}
            aria-label={nextLabel}
            className={WEEK_ARROW_CLASS}
          >
            <ChevronRight size={16} strokeWidth={1.9} />
          </button>
        </div>
        <button
          type="button"
          onClick={() => setAnchor(startOfDay(new Date()))}
          className={`ml-1 ${TODAY_BUTTON_CLASS}`}
        >
          {t("today")}
        </button>
        <div
          role="radiogroup"
          aria-label={t("viewLabel")}
          className="ml-1 flex h-10 shrink-0 items-center gap-[3px] rounded-[10px] bg-[var(--border-soft)] p-[3px]"
        >
          {VIEWS.map((v) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={view === v}
              onClick={() => changeView(v)}
              className={`flex h-[34px] items-center rounded-[8px] px-[12px] text-[13.5px] font-medium transition-[background-color,box-shadow,color] duration-[.12s] ease-out ${
                view === v
                  ? "bg-white text-[var(--ink-primary)] shadow-[var(--shadow-pill)]"
                  : "text-[var(--ink-secondary)] hover:text-[var(--ink-primary)]"
              }`}
            >
              {t(`views.${v}`)}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <MultiSelectFilter
            label={tCommon("status")}
            clearLabel={tCommon("clearStatusFilter")}
            options={statusOptions}
            selected={statusFilter}
            onChange={updateStatusFilter}
          />
          {/* Vehicles/Drivers only splits the day and week timelines into
              rows; the month grid isn't per resource. */}
          {view !== "month" ? (
            <div className="flex h-10 shrink-0 items-center gap-[3px] rounded-[10px] bg-[var(--border-soft)] p-[3px]">
              <button
                type="button"
                onClick={() => setGrouping("vehicle")}
                className={`flex h-[34px] items-center gap-[6px] rounded-[8px] px-[10px] text-[13.5px] font-medium transition-[background-color,box-shadow,color] duration-[.12s] ease-out ${
                  grouping === "vehicle"
                    ? "bg-white text-[var(--ink-primary)] shadow-[var(--shadow-pill)]"
                    : "text-[var(--ink-secondary)] hover:text-[var(--ink-primary)]"
                }`}
              >
                <Bus size={14} strokeWidth={1.9} />
                {t("byVehicle")}
              </button>
              <button
                type="button"
                onClick={() => setGrouping("driver")}
                className={`flex h-[34px] items-center gap-[6px] rounded-[8px] px-[10px] text-[13.5px] font-medium transition-[background-color,box-shadow,color] duration-[.12s] ease-out ${
                  grouping === "driver"
                    ? "bg-white text-[var(--ink-primary)] shadow-[var(--shadow-pill)]"
                    : "text-[var(--ink-secondary)] hover:text-[var(--ink-primary)]"
                }`}
              >
                <UserRound size={14} strokeWidth={1.9} />
                {t("byDriver")}
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {/* The single scroll container for both axes — a sticky header (top)
          and a sticky resource column (left) both need to resolve against
          the SAME scrolling ancestor. Splitting x/y across nested divs
          doesn't work: a div with only overflow-x set has its overflow-y
          computed as auto too (CSS overflow rules), which makes it its own
          (never-scrolling) "scroll box" and breaks sticky-to-the-real-
          scroller for anything inside it. */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto" style={{ containerType: "inline-size" }}>
        {view === "month" ? (
          <MonthGrid
            days={days}
            rides={filteredRides}
            onRideClick={setSelectedRideId}
            onOpenDay={(day) => {
              setAnchor(day);
              changeView("day");
            }}
            onCreateRide={(day) =>
              setCellRideDraft({ departureAt: `${toDateOnlyString(day)}T${CELL_CREATE_DEPARTURE_TIME}`, isRoundTrip: false })
            }
          />
        ) : (
          <ResourceTimelineGrid
            view={view}
            days={days}
            grouping={grouping}
            vehicles={data.vehicles}
            drivers={data.drivers}
            rides={filteredRides}
            blocks={data.blocks}
            onRideClick={setSelectedRideId}
            onDropRide={handleDrop}
            dragOverTarget={dragOverTarget}
            onDragOverResource={handleDragOverResource}
            onDragLeave={() => setDragOverTarget(null)}
            draggingRideId={draggingRideId}
            onResourceAdded={load}
            onCreateRide={setCellRideDraft}
          />
        )}
        {data.unassigned.length > 0 ? (
          // Pinned to the scroller's visible width, so it stays in view when
          // the day/month grid is scrolled sideways (100cqw = the scroller's
          // width; it's the size container below).
          <div className="sticky left-0 w-[100cqw]">
          <UnassignedQueue
            rides={data.unassigned}
            onDragStart={setDraggingRideId}
            onDragEnd={() => {
              setDraggingRideId(null);
              setDragOverTarget(null);
            }}
            onRideClick={setSelectedRideId}
          />
          </div>
        ) : null}
      </div>

      {showNewRide ? (
        <NewRideModal
          onClose={closeNewRide}
          onCreated={() => {
            closeNewRide();
            load();
          }}
          onDepartureDateChange={(date) => setAnchor(startOfDay(date))}
        />
      ) : null}

      {cellRideDraft ? (
        <NewRideModal
          initialValues={cellRideDraftInitialValues(cellRideDraft, grouping)}
          onClose={() => setCellRideDraft(null)}
          onCreated={() => {
            setCellRideDraft(null);
            load();
          }}
        />
      ) : null}

      {selectedRide ? (
        <RideDetailDrawer
          ride={selectedRide}
          vehicles={data.vehicles}
          drivers={data.drivers}
          onClose={() => setSelectedRideId(null)}
          onChanged={() => {
            setSelectedRideId(null);
            load();
          }}
        />
      ) : null}

      {availabilityDialog}
    </div>
  );
}
