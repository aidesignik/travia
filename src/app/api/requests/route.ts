import { NextResponse } from "next/server";
import { auth } from "@/auth/auth";
import { prisma } from "@/lib/prisma";
import { createRideSchema } from "@/lib/validation/request.schema";
import { estimateRouteDistance } from "@/lib/tripDistance";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "CLIENT") {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const requests = await prisma.ride.findMany({
    where: { clientId: session.user.id },
    include: {
      stops: { where: { leg: "OUTBOUND" }, orderBy: { order: "asc" } },
      carrier: true,
      vehicle: true,
      driver: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ requests });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "CLIENT") {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createRideSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  // Round-trip return-leg customization (returnStops) and the carrier-side
  // availability override (force) aren't wired into the client-facing
  // request flow, so they're dropped here rather than passed to Prisma
  // (neither is a Ride column).
  const { stops, returnStops: _returnStops, force: _force, ...data } = parsed.data;

  const created = await prisma.ride.create({
    data: {
      ...data,
      clientId: session.user.id,
      stops: { create: stops.map((stop, index) => ({ ...stop, order: index })) },
    },
    include: { stops: { where: { leg: "OUTBOUND" }, orderBy: { order: "asc" } } },
  });

  // Distance drives the price the client is shown — computed server-side
  // from geocoded pickup/stops/destination, never entered by the client.
  // Best-effort: if geocoding fails, the request still stands, just without
  // a price estimate until a carrier assigns a vehicle.
  try {
    const waypoints = [
      { city: created.pickupCity, location: created.pickupLocation },
      ...created.stops.map((s) => ({ city: s.city, location: s.location })),
      { city: created.destinationCity, location: created.destinationLocation },
    ];
    const estimate = await estimateRouteDistance(waypoints);
    if (estimate) {
      const [pickupCoords, ...rest] = estimate.coordinates;
      const destinationCoords = rest[rest.length - 1];
      const stopCoords = rest.slice(0, -1);

      await prisma.$transaction([
        prisma.ride.update({
          where: { id: created.id },
          data: {
            estimatedDistanceKm: estimate.distanceKm,
            // Empty for Google routes (no coordinates kept) — see RouteEstimate.
            pickupLat: pickupCoords?.lat,
            pickupLng: pickupCoords?.lng,
            destinationLat: destinationCoords?.lat,
            destinationLng: destinationCoords?.lng,
          },
        }),
        ...created.stops.map((stop, index) =>
          prisma.rideStop.update({
            where: { id: stop.id },
            data: { lat: stopCoords[index]?.lat, lng: stopCoords[index]?.lng },
          }),
        ),
      ]);
      created.estimatedDistanceKm = estimate.distanceKm;
    }
  } catch {
    // Leave estimatedDistanceKm null — "available options" simply won't show a price yet.
  }

  return NextResponse.json({ request: created }, { status: 201 });
}
