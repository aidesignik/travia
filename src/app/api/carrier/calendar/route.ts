import { NextResponse } from "next/server";
import { requireApiRole } from "@/auth/api";
import { prisma } from "@/lib/prisma";
import { STOPS_INCLUDE, splitLegs } from "@/lib/rideStopsShape";

const DAY_MS = 24 * 60 * 60 * 1000;
// A month view is the longest range the calendar asks for; anything wider
// is clamped so a bad query string can't pull the carrier's whole history.
const MAX_RANGE_MS = 45 * DAY_MS;
// How long the day view draws a one-way ride (no return time) — matches
// AVERAGE_TRIP_DURATION in lib/availability.ts.
const ONE_WAY_SPAN_MS = 4 * 60 * 60 * 1000;

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

// Returns everything the resource-timeline calendar needs for the visible
// range (a day, a week or a month): the carrier's vehicles/drivers (rows),
// rides and blocks overlapping that range (blocks), and the always-visible
// unassigned-ride queue (not scoped to the range — a carrier should see
// every ride waiting on them).
export async function GET(request: Request) {
  const { session, error } = await requireApiRole("CARRIER");
  if (error) return error;

  const { searchParams } = new URL(request.url);
  // The client already resolves the range to its own local midnights and
  // sends the exact UTC instants (see RidesCalendar's viewRange) — calling
  // setHours() here would re-floor them using the *server's* local time
  // zone instead (UTC on Vercel), silently shifting the range back by up to
  // a day and cutting its last day out of the query below. `weekStart` is
  // the older one-week form of the same request.
  const rangeStart = parseDate(searchParams.get("start")) ?? parseDate(searchParams.get("weekStart")) ?? new Date();
  const requestedEnd = parseDate(searchParams.get("end")) ?? new Date(rangeStart.getTime() + 7 * DAY_MS);
  const span = Math.min(MAX_RANGE_MS, Math.max(60 * 60 * 1000, requestedEnd.getTime() - rangeStart.getTime()));
  const rangeEnd = new Date(rangeStart.getTime() + span);

  const carrier = await prisma.carrier.findUniqueOrThrow({ where: { userId: session.user.id } });

  const [vehicles, drivers, rides, blocks, unassigned] = await Promise.all([
    prisma.vehicle.findMany({ where: { carrierId: carrier.id }, orderBy: { createdAt: "asc" } }),
    prisma.driver.findMany({ where: { carrierId: carrier.id }, orderBy: { createdAt: "asc" } }),
    prisma.ride.findMany({
      where: {
        carrierId: carrier.id,
        status: { in: ["PENDING", "CONFIRMED", "COMPLETED"] },
        OR: [{ vehicleId: { not: null } }, { driverId: { not: null } }],
        departureAt: { lt: rangeEnd },
        // Overlaps the range: a round trip until its return, a one-way ride
        // from its departure. (Matching every one-way ride with returnAt:
        // null used to pull in all earlier weeks' one-way rides, which the
        // grid then pinned to the first day.) A one-way ride is shown for
        // the average trip length in the day view, so one that left in the
        // few hours before the range can still reach into it.
        AND: [
          {
            OR: [
              { returnAt: null, departureAt: { gte: new Date(rangeStart.getTime() - ONE_WAY_SPAN_MS) } },
              { returnAt: { gte: rangeStart } },
            ],
          },
        ],
      },
      include: { client: { select: { name: true, companyName: true, phone: true, email: true } }, stops: STOPS_INCLUDE },
    }),
    prisma.block.findMany({
      where: { carrierId: carrier.id, startAt: { lt: rangeEnd }, endAt: { gte: rangeStart } },
    }),
    // Truly untouched rides only (no vehicle AND no driver yet) — either
    // marketplace-wide (nobody's claimed it) or this carrier's own
    // quick-created rides still waiting on an assignment.
    prisma.ride.findMany({
      where: {
        status: "PENDING",
        vehicleId: null,
        driverId: null,
        OR: [{ carrierId: null }, { carrierId: carrier.id }],
      },
      include: { client: { select: { name: true, companyName: true, phone: true, email: true } }, stops: STOPS_INCLUDE },
      orderBy: { departureAt: "asc" },
    }),
  ]);

  return NextResponse.json({
    rangeStart: rangeStart.toISOString(),
    rangeEnd: rangeEnd.toISOString(),
    vehicles,
    drivers,
    rides: rides.map(splitLegs),
    blocks,
    unassigned: unassigned.map(splitLegs),
  });
}
