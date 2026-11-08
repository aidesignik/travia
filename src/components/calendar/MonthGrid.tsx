"use client";

import { useLocale, useTranslations } from "next-intl";
import { RideMonthBar } from "./RideMonthBar";
import type { CalendarRide } from "./types";

// Each day shows at most this many lanes of rides; a day with more gets
// "+N more", which opens it in the day view.
const MAX_LANES = 2;
// Week row geometry: padding above the date badge, the badge, one ride
// lane, the "+N more" link, and the gap between them. Rows are never
// shorter than what two lanes plus the link need.
const CELL_PADDING = 4;
const DATE_BADGE = 22;
const ENTRY = 30;
const MORE_LINK = 16;
const GAP = 3;
const MIN_ROW_HEIGHT = CELL_PADDING * 2 + DATE_BADGE + MAX_LANES * (GAP + ENTRY) + GAP + MORE_LINK;
const DAY_MS = 86_400_000;

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

interface Segment {
  ride: CalendarRide;
  // Columns (0–6, Monday first) this ride covers in one week row.
  startCol: number;
  endCol: number;
  // Whether the ride carries on from the previous row / into the next.
  continuesBefore: boolean;
  continuesAfter: boolean;
  lane: number;
}

// Stacks a week's ride segments into lanes (rows) so overlapping rides sit
// one above the other and a ride keeps a single lane across its days.
// Longer rides go first, so multi-day bars settle into the top lanes.
function assignLanes(segments: Omit<Segment, "lane">[]): Segment[] {
  const laneEnds: number[] = [];
  return [...segments]
    .sort(
      (a, b) =>
        a.startCol - b.startCol ||
        b.endCol - b.startCol - (a.endCol - a.startCol) ||
        new Date(a.ride.departureAt).getTime() - new Date(b.ride.departureAt).getTime(),
    )
    .map((segment) => {
      let lane = laneEnds.findIndex((end) => end < segment.startCol);
      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(segment.endCol);
      } else {
        laneEnds[lane] = segment.endCol;
      }
      return { ...segment, lane };
    });
}

// The month view: a classic Monday-first month grid that fits the visible
// area (no scrolling), unlike the day/week resource timeline. A ride is one
// continuous bar across the days it spans — destination and client, status
// as its colour — split only where it wraps onto the next week row (squared
// ends show it carries on). Each day shows up to two rides; a day with more
// gets "+N more", which opens that day in the day view. Clicking a date
// opens it in the day view; clicking a day's empty space starts a new ride
// on it.
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
  // Cell index of a date (rounded, so a DST change in between can't shift it).
  const cellIndex = (date: Date) => Math.round((startOfDay(date).getTime() - gridStart.getTime()) / DAY_MS);
  const firstIdx = cellIndex(first);
  const lastIdx = cellIndex(last);

  // Each ride as one segment per week row it touches, clamped to the month.
  const segmentsByWeek: Omit<Segment, "lane">[][] = Array.from({ length: weeks }, () => []);
  for (const ride of rides) {
    const rawStart = cellIndex(new Date(ride.departureAt));
    const rawEnd = ride.returnAt ? cellIndex(new Date(ride.returnAt)) : rawStart;
    const start = Math.max(rawStart, firstIdx);
    const end = Math.min(rawEnd, lastIdx);
    if (end < start) continue;
    for (let week = Math.floor(start / 7); week <= Math.floor(end / 7); week++) {
      const segStart = Math.max(start, week * 7);
      const segEnd = Math.min(end, week * 7 + 6);
      segmentsByWeek[week].push({
        ride,
        startCol: segStart - week * 7,
        endCol: segEnd - week * 7,
        continuesBefore: segStart > rawStart,
        continuesAfter: segEnd < rawEnd,
      });
    }
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
        className="grid min-h-0 flex-1"
        style={{ gridTemplateRows: `repeat(${weeks}, minmax(${MIN_ROW_HEIGHT}px, 1fr))` }}
      >
        {Array.from({ length: weeks }, (_, week) => {
          const segments = assignLanes(segmentsByWeek[week]);
          const laneCount = segments.reduce((max, s) => Math.max(max, s.lane + 1), 0);
          const visibleLanes = Math.min(laneCount, MAX_LANES);
          const hiddenPerDay = Array.from({ length: 7 }, (_, col) =>
            segments.filter((s) => s.lane >= visibleLanes && s.startCol <= col && s.endCol >= col).length,
          );
          const hasMore = hiddenPerDay.some((n) => n > 0);
          const isLastWeek = week === weeks - 1;

          return (
            <div
              key={week}
              className={`relative grid min-h-0 grid-cols-7 content-start overflow-hidden ${isLastWeek ? "" : "border-b border-[#F1F1EE]"}`}
              style={{
                gridTemplateRows: `${CELL_PADDING + DATE_BADGE}px repeat(${visibleLanes}, ${ENTRY}px)${hasMore ? ` ${MORE_LINK}px` : ""}`,
                rowGap: GAP,
              }}
            >
              {/* Day cells: background, borders, date badge, click-to-create. */}
              {Array.from({ length: 7 }, (_, col) => {
                const day = cells[week * 7 + col];
                const inMonth = day.getMonth() === month;
                const isToday = day.getTime() === today;
                return (
                  <div
                    key={col}
                    title={inMonth ? t("createRideOnDay") : undefined}
                    onClick={(e) => {
                      if (inMonth && e.target === e.currentTarget) onCreateRide(day);
                    }}
                    className={`min-w-0 px-[6px] pt-[4px] ${col === 6 ? "" : "border-r border-[#F1F1EE]"} ${
                      inMonth ? "cursor-pointer bg-white transition-colors duration-[.1s] hover:bg-[var(--action-100)]/30" : "bg-[#FAFAF8]"
                    }`}
                    // Spans the row's full height (past the last grid line, so
                    // it fills any spare space below the lanes too).
                    style={{ gridColumn: col + 1, gridRow: "1 / -1", marginBottom: -9999, paddingBottom: 9999 }}
                  >
                    <button
                      type="button"
                      disabled={!inMonth}
                      onClick={() => onOpenDay(day)}
                      title={inMonth ? t("openDay") : undefined}
                      className={`flex h-[22px] min-w-[22px] items-center justify-center rounded-full px-[6px] text-[13px] font-semibold tabular-nums transition-colors duration-[.1s] ${
                        isToday
                          ? "bg-[var(--action-bg)] text-white"
                          : inMonth
                            ? "text-[#1B1B19] hover:bg-[var(--border-soft)]"
                            : "cursor-default text-[#B4B4AE]"
                      }`}
                    >
                      {day.getDate()}
                    </button>
                  </div>
                );
              })}

              {/* Ride bars, one per segment, spanning their days. */}
              {segments
                .filter((s) => s.lane < visibleLanes)
                .map((s) => (
                  <div
                    key={`${s.ride.id}-${week}`}
                    className="z-10 min-w-0"
                    style={{
                      gridRow: s.lane + 2,
                      gridColumn: `${s.startCol + 1} / ${s.endCol + 2}`,
                      marginLeft: s.continuesBefore ? 0 : 5,
                      marginRight: s.continuesAfter ? 0 : 5,
                    }}
                  >
                    <RideMonthBar
                      ride={s.ride}
                      onClick={() => onRideClick(s.ride.id)}
                      continuesBefore={s.continuesBefore}
                      continuesAfter={s.continuesAfter}
                    />
                  </div>
                ))}

              {/* "+N more" under the days with rides that didn't fit. */}
              {hiddenPerDay.map((hidden, col) =>
                hidden > 0 ? (
                  <button
                    key={`more-${col}`}
                    type="button"
                    onClick={() => onOpenDay(cells[week * 7 + col])}
                    className="z-10 ml-[6px] h-[16px] self-start justify-self-start rounded-[6px] px-[6px] text-[12px] font-semibold leading-[16px] text-[var(--ink-secondary)] hover:bg-[var(--border-soft)] hover:text-[var(--ink-primary)]"
                    style={{ gridRow: visibleLanes + 2, gridColumn: col + 1 }}
                  >
                    {t("moreRides", { count: hidden })}
                  </button>
                ) : null,
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
