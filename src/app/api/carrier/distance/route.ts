import { NextResponse } from "next/server";
import { requireApiRole } from "@/auth/api";
import { estimateTripDistance } from "@/lib/tripDistance";
import { tripDistanceSchema } from "@/lib/validation/tripDistance.schema";

// Lightweight, purpose-built for a live "how many km is this?" preview as a
// carrier types pickup/stops/destination (and, for a round trip, the
// return leg) — no vehicle/driver/price needed.
export async function POST(request: Request) {
  const { error } = await requireApiRole("CARRIER");
  if (error) return error;

  const body = await request.json().catch(() => null);
  const parsed = tripDistanceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const result = await estimateTripDistance(parsed.data);
  if (result === null) {
    return NextResponse.json({ error: "DISTANCE_UNAVAILABLE" }, { status: 422 });
  }

  // distanceKm kept as the total for existing callers that only read that
  // field; outboundKm/returnKm are additive, for a breakdown display.
  return NextResponse.json({ distanceKm: result.totalKm, outboundKm: result.outboundKm, returnKm: result.returnKm, approximate: result.approximate });
}
