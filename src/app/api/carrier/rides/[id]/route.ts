import { NextResponse } from "next/server";
import { requireApiRole } from "@/auth/api";
import { prisma } from "@/lib/prisma";
import { editRideSchema } from "@/lib/validation/editRide.schema";
import { checkAvailability, effectiveRideEnd } from "@/lib/availability";
import { buildStopsCreate, returnLegScalars, resolveReturnLeg } from "@/lib/rideReturnLeg";
import { suggestPrice } from "@/lib/pricing";
import { estimateRouteDistance } from "@/lib/tripDistance";
import { regenerateRideDocuments } from "@/lib/documents/regenerate";
import { displayRideStatus } from "@/lib/rideStatus";

// Editing a ride — the carrier-facing "Edit ride" form is the same one used
// to create a ride (see quick/route.ts), reused with the current values
// filled in, so this endpoint accepts the same shape (client, trip, price,
// vehicle/driver) and mirrors that route's logic for each. The one
// structural difference from create: vehicle/driver/price are nullable, not
// optional — the edit form always resubmits its whole current state, so
// null unambiguously means "the carrier cleared this" (see editRide.schema).
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireApiRole("CARRIER");
  if (error) return error;
  const { id } = await params;

  const body = await request.json().catch(() => null);
  const parsed = editRideSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  const carrier = await prisma.carrier.findUniqueOrThrow({ where: { userId: session.user.id } });
  if (carrier.status !== "APPROVED") {
    return NextResponse.json({ error: "CARRIER_NOT_APPROVED" }, { status: 403 });
  }

  const ride = await prisma.ride.findFirst({ where: { id, carrierId: carrier.id } });
  if (!ride) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (ride.status === "CANCELLED" || ride.status === "COMPLETED") {
    return NextResponse.json({ error: "RIDE_NOT_EDITABLE" }, { status: 409 });
  }

  // Same client-resolution rules as quick-create: a clientId pick saves
  // edits back to that record; otherwise the email decides whether this is
  // an existing client (reused as-is) or a brand new one.
  const email = data.clientEmail.toLowerCase();
  let client = null;

  if (data.clientId) {
    const selected = await prisma.user.findFirst({ where: { id: data.clientId, role: "CLIENT" } });
    if (selected) {
      if (selected.email !== email) {
        const emailOwner = await prisma.user.findUnique({ where: { email } });
        if (emailOwner && emailOwner.id !== selected.id) {
          return NextResponse.json({ error: "EMAIL_BELONGS_TO_OTHER_ROLE" }, { status: 409 });
        }
      }
      client = await prisma.user.update({
        where: { id: selected.id },
        data: {
          email,
          name: data.clientName,
          companyName: data.clientCompanyName || undefined,
          phone: data.clientPhone,
        },
      });
    }
  }

  if (!client) {
    client = await prisma.user.findUnique({ where: { email } });
    if (client && client.role !== "CLIENT") {
      return NextResponse.json({ error: "EMAIL_BELONGS_TO_OTHER_ROLE" }, { status: 409 });
    }
    if (!client) {
      client = await prisma.user.create({
        data: {
          email,
          name: data.clientName,
          companyName: data.clientCompanyName || undefined,
          phone: data.clientPhone,
          role: "CLIENT",
        },
      });
    }
  }

  const [vehicle, driver] = await Promise.all([
    data.vehicleId
      ? prisma.vehicle.findFirst({ where: { id: data.vehicleId, carrierId: carrier.id } })
      : null,
    data.driverId ? prisma.driver.findFirst({ where: { id: data.driverId, carrierId: carrier.id } }) : null,
  ]);
  if (data.vehicleId && !vehicle) {
    return NextResponse.json({ error: "VEHICLE_OR_DRIVER_NOT_FOUND" }, { status: 404 });
  }
  if (data.driverId && !driver) {
    return NextResponse.json({ error: "VEHICLE_OR_DRIVER_NOT_FOUND" }, { status: 404 });
  }

  if (data.vehicleId || data.driverId) {
    const availability = await checkAvailability({
      vehicleId: data.vehicleId ?? undefined,
      driverId: data.driverId ?? undefined,
      start: data.departureAt,
      end: effectiveRideEnd(data.departureAt, data.returnAt ?? null),
      excludeRideId: ride.id,
    });
    // Advisory only — see assign/route.ts.
    if (!availability.available && !data.force) {
      return NextResponse.json({ error: "UNAVAILABLE", conflicts: availability.conflicts }, { status: 409 });
    }
  }

  // Same as quick-create: the carrier's own typed price always wins: only
  // suggest one from distance when the field was left empty and a vehicle +
  // driver end up assigned.
  let distanceKm = data.distanceKm;
  let price = data.price;
  if (price === null && data.vehicleId && data.driverId) {
    if (!distanceKm) {
      const outboundWaypoints = [
        { city: data.pickupCity, location: data.pickupLocation },
        ...data.stops,
        { city: data.destinationCity, location: data.destinationLocation },
      ];
      const outboundEstimate = await estimateRouteDistance(outboundWaypoints).catch(() => null);
      distanceKm = outboundEstimate?.distanceKm;

      if (distanceKm !== undefined && data.isRoundTrip) {
        const returnLeg = resolveReturnLeg(data, data);
        const returnWaypoints = [
          { city: returnLeg.pickupCity, location: returnLeg.pickupLocation },
          ...returnLeg.stops,
          { city: returnLeg.destinationCity, location: returnLeg.destinationLocation },
        ];
        const returnEstimate = await estimateRouteDistance(returnWaypoints).catch(() => null);
        distanceKm = returnEstimate ? distanceKm + returnEstimate.distanceKm : undefined;
      }
    }
    if (distanceKm) {
      price = suggestPrice(distanceKm, {
        ratePerKm: carrier.ratePerKm ? Number(carrier.ratePerKm) : null,
        fixedFee: carrier.fixedFee ? Number(carrier.fixedFee) : null,
      });
    }
  }

  const updated = await prisma.ride.update({
    where: { id: ride.id },
    data: {
      clientId: client.id,
      pickupCity: data.pickupCity,
      pickupLocation: data.pickupLocation,
      destinationCity: data.destinationCity,
      destinationLocation: data.destinationLocation,
      departureAt: data.departureAt,
      isRoundTrip: data.isRoundTrip,
      returnAt: data.isRoundTrip ? data.returnAt : null,
      ...returnLegScalars(data),
      passengerCount: data.passengerCount,
      specialRequests: data.specialRequests,
      estimatedDistanceKm: distanceKm ?? ride.estimatedDistanceKm,
      price,
      vehicleId: data.vehicleId,
      driverId: data.driverId,
      status: data.vehicleId && data.driverId ? "CONFIRMED" : "PENDING",
      stops: {
        deleteMany: {},
        create: buildStopsCreate(data),
      },
    },
  });

  await regenerateRideDocuments(updated.id);

  return NextResponse.json({ ride: updated });
}

// Permanently removes a ride whose trip window has passed without ever
// being explicitly completed — the "remove from calendar" action in
// RideDetailDrawer, offered instead of a manual "mark completed" step.
// Only allowed in that same window (still CONFIRMED, past departure/return)
// so an in-progress or future ride can't be deleted this way.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireApiRole("CARRIER");
  if (error) return error;
  const { id } = await params;

  const carrier = await prisma.carrier.findUniqueOrThrow({ where: { userId: session.user.id } });
  const ride = await prisma.ride.findFirst({ where: { id, carrierId: carrier.id } });
  if (!ride) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const status = displayRideStatus({
    status: ride.status,
    departureAt: ride.departureAt.toISOString(),
    returnAt: ride.returnAt?.toISOString() ?? null,
  });
  if (ride.status !== "CONFIRMED" || status !== "COMPLETED") {
    return NextResponse.json({ error: "RIDE_NOT_REMOVABLE" }, { status: 409 });
  }

  await prisma.$transaction([
    prisma.document.deleteMany({ where: { rideId: id } }),
    prisma.rideStop.deleteMany({ where: { rideId: id } }),
    prisma.ride.delete({ where: { id } }),
  ]);

  return NextResponse.json({ ok: true });
}
