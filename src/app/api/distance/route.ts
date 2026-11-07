import { NextResponse } from "next/server";
import { estimateTripDistance } from "@/lib/tripDistance";
import { tripDistanceSchema } from "@/lib/validation/tripDistance.schema";

// Public counterpart to /api/carrier/distance — lets a client (or a
// not-yet-signed-up visitor on the public search) see roughly how far a
// trip is before they submit a request, same debounced live-preview
// pattern, same underlying estimate. No auth: the public landing-page
// search already works without a session, and this carries no carrier
// data, just a geocoding/routing lookup.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = tripDistanceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const result = await estimateTripDistance(parsed.data);
  if (result === null) {
    return NextResponse.json({ error: "DISTANCE_UNAVAILABLE" }, { status: 422 });
  }

  return NextResponse.json({ distanceKm: result.totalKm, outboundKm: result.outboundKm, returnKm: result.returnKm, approximate: result.approximate });
}
