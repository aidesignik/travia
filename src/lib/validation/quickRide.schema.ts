import { z } from "zod";
import { cityLocationSchema } from "./request.schema";

// The calendar's "+ New Ride" quick-create form — client + trip details
// only, no vehicle/driver/price. Lands in the carrier's own unassigned
// queue; assignment happens afterward from the calendar itself.
export const quickRideSchema = z
  .object({
    // Set when the carrier picked an existing client from the combobox
    // (see /api/carrier/clients) — lets edits to the autofilled fields
    // (a corrected email, a new phone number) update that client's own
    // record instead of being discarded or creating a disconnected one.
    clientId: z.string().min(1).optional(),
    clientCompanyName: z.string().optional(),
    clientName: z.string().min(1),
    clientEmail: z.string().email(),
    clientPhone: z.string().optional(),

    pickupCity: z.string().min(1),
    pickupLocation: z.string().min(1),
    destinationCity: z.string().min(1),
    destinationLocation: z.string().min(1),
    stops: z.array(cityLocationSchema).max(5).default([]),
    departureAt: z.coerce.date(),
    isRoundTrip: z.coerce.boolean().default(false),
    returnAt: z.coerce.date().optional(),
    // The return leg defaults to the outbound leg reversed — these are only
    // set when a different pickup/destination/stops is picked for the way
    // back (see resolveReturnLeg()).
    returnPickupCity: z.string().min(1).optional(),
    returnPickupLocation: z.string().min(1).optional(),
    returnStops: z.array(cityLocationSchema).max(5).default([]),
    returnDestinationCity: z.string().min(1).optional(),
    returnDestinationLocation: z.string().min(1).optional(),
    passengerCount: z.coerce.number().int().min(1).max(200),
    specialRequests: z.string().optional(),
    // The form's own live distance preview (see /api/carrier/distance) —
    // stored up front so assignment doesn't need to re-estimate it later.
    distanceKm: z.coerce.number().positive().optional(),
    // The carrier's own manually-typed price (excl. VAT) — takes priority
    // over the ratePerKm/fixedFee auto-suggestion once price suggestions
    // exist; for now it's the only source of a price at creation time.
    price: z.coerce.number().positive().optional(),
    // Optional "assign now" — if the carrier already knows who's free, per
    // the availability-filtered picker on the form. Left unset, the ride
    // lands in the unassigned queue as before.
    vehicleId: z.string().min(1).optional(),
    driverId: z.string().min(1).optional(),
    // Set after the dispatcher confirms past an availability warning —
    // bypasses the conflict check rather than blocking the assignment.
    force: z.coerce.boolean().default(false),
  })
  .refine((data) => !data.isRoundTrip || data.returnAt !== undefined, {
    message: "returnAt is required for a round trip",
    path: ["returnAt"],
  })
  .refine((data) => !data.returnAt || data.returnAt > data.departureAt, {
    message: "returnAt must be after departureAt",
    path: ["returnAt"],
  });
