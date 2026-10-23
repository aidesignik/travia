import { NextResponse } from "next/server";
import { requireApiRole } from "@/auth/api";
import { prisma } from "@/lib/prisma";
import { quickRideSchema } from "@/lib/validation/quickRide.schema";
import { checkAvailability, effectiveRideEnd } from "@/lib/availability";
import { buildStopsCreate, returnLegScalars, resolveReturnLeg } from "@/lib/rideReturnLeg";
import { suggestPrice } from "@/lib/pricing";
import { estimateRouteDistance } from "@/lib/tripDistance";
import { regenerateRideDocuments } from "@/lib/documents/regenerate";

// The calendar's "+ New Ride" button — creates a ride already claimed by
// this carrier (so it shows in their own unassigned queue, not the
// marketplace-wide one). Vehicle/driver are optional: if the carrier
// already knows who's free and picks one on the form, it's assigned right
// away (subject to the same availability check as the calendar's drag-and-
// drop) and the ride is immediately CONFIRMED — there's no separate client
// waiting on a confirmation, the carrier creating it is the confirmation.
// Left unassigned, it lands PENDING and gets dispatched (and confirmed via
// the assign endpoint) later.
export async function POST(request: Request) {
  const { session, error } = await requireApiRole("CARRIER");
  if (error) return error;

  const body = await request.json().catch(() => null);
  const parsed = quickRideSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  const carrier = await prisma.carrier.findUniqueOrThrow({ where: { userId: session.user.id } });
  if (carrier.status !== "APPROVED") {
    return NextResponse.json({ error: "CARRIER_NOT_APPROVED" }, { status: 403 });
  }

  const email = data.clientEmail.toLowerCase();
  let client = null;

  // A client explicitly picked from the combobox — any edits made after
  // autofilling (a corrected email, a different phone) are saved back to
  // that same client record, so the next pick shows the updated info.
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
      vehicleId: data.vehicleId,
      driverId: data.driverId,
      start: data.departureAt,
      end: effectiveRideEnd(data.departureAt, data.returnAt ?? null),
    });
    // Advisory only — see assign/route.ts.
    if (!availability.available && !data.force) {
      return NextResponse.json({ error: "UNAVAILABLE", conflicts: availability.conflicts }, { status: 409 });
    }
  }

  // Assigning both up front skips the later /assign step entirely, so this
  // is the only place that ride's price (and thus its documents) ever gets
  // computed — without this, a ride created with vehicle+driver already
  // picked would stay CONFIRMED with a null price forever, and the
  // documents section (and its "email to client" action) would never
  // appear. Mirrors /assign's own distance/price computation.
  //
  // The carrier's own typed price (data.price) always wins over the
  // auto-suggestion — it's entered up front in the form regardless of
  // whether a vehicle/driver gets picked in this same request, unlike the
  // suggestion below, which only runs once both are.
  let distanceKm = data.distanceKm;
  let price: number | undefined = data.price;
  if (price === undefined && data.vehicleId && data.driverId) {
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

  const ride = await prisma.ride.create({
    data: {
      clientId: client.id,
      carrierId: carrier.id,
      vehicleId: data.vehicleId,
      driverId: data.driverId,
      pickupCity: data.pickupCity,
      pickupLocation: data.pickupLocation,
      destinationCity: data.destinationCity,
      destinationLocation: data.destinationLocation,
      departureAt: data.departureAt,
      isRoundTrip: data.isRoundTrip,
      returnAt: data.returnAt,
      ...returnLegScalars(data),
      passengerCount: data.passengerCount,
      specialRequests: data.specialRequests,
      estimatedDistanceKm: distanceKm,
      price,
      status: data.vehicleId && data.driverId ? "CONFIRMED" : "PENDING",
      stops: { create: buildStopsCreate(data) },
    },
  });

  if (data.vehicleId && data.driverId) {
    await regenerateRideDocuments(ride.id);
  }

  return NextResponse.json({ ride }, { status: 201 });
}
