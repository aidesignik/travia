"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { RideMonthBar } from "./RideMonthBar";
import type { CalendarRide } from "./types";

// Day cell geometry, used to work out how many ride entries fit in a cell
// of the current height: padding (top + bottom), the date badge, one entry,
// the "+N more" link, and the gap between items.
const CELL_PADDING = 12;
const DATE_BADGE = 24;
const ENTRY = 34;
const MORE_LINK = 18;
const GAP = 4;
// Rows never get shorter than this; on a very short window the grid then
// scrolls rather than squeezing entries out entirely.
const MIN_ROW_HEIGHT = 96;

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// The month view: a classic Monday-first month grid that fits the visible
// area (no scrolling), unlike the day/week resource timeline. Each day lists
// as many of its rides — destination and client — as its cell has room for,
// then "+N more", which opens that day in the day view. A ride spanning
// several days (a multi-day tour) is listed on each of them, with
// "2/3"-style day counts. Clicking a date opens that day in the day view;
// clicking a day's empty space starts a new ride on it.
export function MonthGrid({
  days,
  rides,
  onRideClick,
  onOpenDay,
  onCreateRide,
}: {
  // Every day of the visible month, local midnights.
  days: Date[];
  rides: CalendarRide[];
  onRideClick: (rideId: string) => void;
  onOpenDay: (day: Date) => void;
  onCreateRide: (day: Date) => void;
}) {
  const t = useTranslations("carrier.calendar");
  const locale = useLocale();
  const intlLocale = locale === "sr" ? "sr-Latn" : "en";
  const today = startOfDay(new Date()).getTime();
  const month = days[0].getMonth();

  // Full weeks: from the Monday on/before the 1st to the Sunday on/after
  // the last day. Days outside the month are shown muted and empty (the
  // calendar only loads the month itself).
  const first = days[0];
  const gridStart = addDays(first, -((first.getDay() + 6) % 7));
  const last = days[days.length - 1];
  const gridEnd = addDays(last, (7 - last.getDay()) % 7);
  const cells: Date[] = [];
  for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) cells.push(d);
  const weekdays = cells.slice(0, 7).map((d) => d.toLocaleDateString(intlLocale, { weekday: "short" }));
  const weeks = cells.length / 7;

  // Rows share the visible height, so how many entries a cell can show
  // depends on the window — measured, and re-measured on resize.
  const gridRef = useRef<HTMLDivElement>(null);
  const [rowHeight, setRowHeight] = useState(0);
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const measure = () => setRowHeight(el.clientHeight / weeks);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [weeks]);
  const room = Math.max(rowHeight, MIN_ROW_HEIGHT) - CELL_PADDING - DATE_BADGE;
  // Entries shown in a day with `count` rides: all of them if they fit,
  // otherwise as many as fit above the "+N more" link (at least one).
  const visibleCount = (count: number) =>
    count * (ENTRY + GAP) <= room ? count : Math.max(1, Math.floor((room - MORE_LINK - GAP) / (ENTRY + GAP)));

  // Rides per day (keyed by local midnight), each with its day number
  // within the ride for multi-day rides.
  const byDay = new Map<number, { ride: CalendarRide; dayNo: number; dayCount: number }[]>();
  for (const ride of rides) {
    const start = startOfDay(new Date(ride.departureAt));
    const end = ride.returnAt ? startOfDay(new Date(ride.returnAt)) : start;
    const dayCount = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
    for (let i = 0, d = start; d <= end; i++, d = addDays(d, 1)) {
      const key = d.getTime();
      if (!byDay.has(key)) byDay.set(key, []);
      byDay.get(key)!.push({ ride, dayNo: i + 1, dayCount });
    }
  }
  for (const list of byDay.values()) {
    list.sort((a, b) => new Date(a.ride.departureAt).getTime() - new Date(b.ride.departureAt).getTime());
  }

  return (
    <div className="flex h-full flex-col">
      <div className="sticky top-0 z-20 grid grid-cols-7 border-b border-[#EFEFEC] bg-white">
        {weekdays.map((name, i) => (
          <div
            key={i}
            className="border-r border-[#F1F1EE] px-3 py-3 text-[13px] font-medium capitalize text-[#6E6E68] last:border-r-0"
          >
            {name}
          </div>
        ))}
      </div>
      <div
        ref={gridRef}
        className="grid min-h-0 flex-1 grid-cols-7"
        style={{ gridTemplateRows: `repeat(${weeks}, minmax(${MIN_ROW_HEIGHT}px, 1fr))` }}
      >
        {cells.map((day, i) => {
          const inMonth = day.getMonth() === month;
          const isToday = day.getTime() === today;
          const entries = inMonth ? byDay.get(day.getTime()) ?? [] : [];
          const shown = entries.slice(0, visibleCount(entries.length));
          const hidden = entries.length - shown.length;
          const lastRow = i >= cells.length - 7;
          return (
            <div
              key={day.getTime()}
              title={inMonth ? t("createRideOnDay") : undefined}
              onClick={(e) => {
                if (inMonth && e.target === e.currentTarget) onCreateRide(day);
              }}
              className={`flex min-w-0 flex-col gap-[4px] overflow-hidden border-[#F1F1EE] p-[6px] ${i % 7 === 6 ? "" : "border-r"} ${
                lastRow ? "" : "border-b"
              } ${inMonth ? "cursor-pointer bg-white transition-colors duration-[.1s] hover:bg-[var(--action-100)]/30" : "bg-[#FAFAF8]"}`}
            >
              <button
                type="button"
                disabled={!inMonth}
                onClick={() => onOpenDay(day)}
                title={inMonth ? t("openDay") : undefined}
                className={`flex h-[24px] min-w-[24px] shrink-0 items-center justify-center self-start rounded-full px-[6px] text-[13.5px] font-semibold tabular-nums transition-colors duration-[.1s] ${
                  isToday
                    ? "bg-[var(--action-bg)] text-white"
                    : inMonth
                      ? "text-[#1B1B19] hover:bg-[var(--border-soft)]"
                      : "cursor-default text-[#B4B4AE]"
                }`}
              >
                {day.getDate()}
              </button>
              {shown.map(({ ride, dayNo, dayCount }) => (
                <div key={ride.id} className="shrink-0" style={{ height: ENTRY }}>
                  <RideMonthBar
                    ride={ride}
                    onClick={() => onRideClick(ride.id)}
                    dayLabel={dayCount > 1 ? `${dayNo}/${dayCount}` : undefined}
                  />
                </div>
              ))}
              {hidden > 0 ? (
                <button
                  type="button"
                  onClick={() => onOpenDay(day)}
                  className="h-[18px] shrink-0 self-start rounded-[6px] px-[6px] text-[12px] font-semibold text-[var(--ink-secondary)] hover:bg-[var(--border-soft)] hover:text-[var(--ink-primary)]"
                >
                  {t("moreRides", { count: hidden })}
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
