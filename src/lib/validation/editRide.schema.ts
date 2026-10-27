import { z } from "zod";
import { cityLocationSchema } from "./request.schema";

// "Edit ride" — the same form as the calendar's "+ New Ride" (quick-create),
// reused to modify an existing ride, so this mirrors quickRideSchema field
// for field. The one difference: vehicleId/driverId/price are nullable
// rather than optional. Quick-create only ever adds them, so "not sent"
// unambiguously means "skip" — but an edit always resubmits the form's
// whole current state, so null is needed to say "the carrier cleared this"
// as distinct from undefined ("field omitted" never happens here).
export const editRideSchema = z
  .object({
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
    returnPickupCity: z.string().min(1).optional(),
    returnPickupLocation: z.string().min(1).optional(),
    returnStops: z.array(cityLocationSchema).max(5).default([]),
    returnDestinationCity: z.string().min(1).optional(),
    returnDestinationLocation: z.string().min(1).optional(),
    passengerCount: z.coerce.number().int().min(1).max(200),
    specialRequests: z.string().optional(),
    distanceKm: z.coerce.number().positive().optional(),
    price: z.coerce.number().positive().nullable(),
    vehicleId: z.string().min(1).nullable(),
    driverId: z.string().min(1).nullable(),
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
