import { NextResponse } from "next/server";
import { autocompletePlaces, googleMapsEnabled } from "@/lib/googleMaps";
import { findCityCoordinates } from "@/lib/citySearch";
import { guardPlacesRequest } from "@/lib/placesRequest";

// Suggestions for the "exact location" field (PlaceLocationInput), biased
// to the ride's chosen city. `enabled: false` tells the field to stop
// asking and behave as plain text — no key configured.
export async function GET(request: Request) {
  if (!googleMapsEnabled()) {
    return NextResponse.json({ enabled: false, suggestions: [] });
  }

  const guard = await guardPlacesRequest(request);
  if ("error" in guard) return guard.error;

  const input = (guard.params.get("q") ?? "").trim().slice(0, 120);
  if (input.length < 3) {
    return NextResponse.json({ enabled: true, suggestions: [] });
  }

  const city = (guard.params.get("city") ?? "").trim();
  const suggestions = await autocompletePlaces({
    input,
    sessionToken: guard.sessionToken,
    language: guard.language,
    near: city ? findCityCoordinates(city) : null,
  });
  if (suggestions === null) {
    return NextResponse.json({ error: "PLACES_UNAVAILABLE" }, { status: 502 });
  }
  return NextResponse.json({ enabled: true, suggestions });
}
