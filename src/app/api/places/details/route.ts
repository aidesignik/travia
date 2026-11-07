import { NextResponse } from "next/server";
import { composePlaceLocation, googleMapsEnabled, placeAddressParts } from "@/lib/googleMaps";
import { guardPlacesRequest } from "@/lib/placesRequest";

const PLACE_ID = /^[A-Za-z0-9_-]{10,400}$/;

// Called once when a suggestion is picked: ends the autocomplete session
// (which is what makes its keystrokes free) and returns the text to put in
// the "exact location" field — name, street, borough. If the details call
// fails, the suggestion's own text is still returned, so picking always
// works.
export async function GET(request: Request) {
  if (!googleMapsEnabled()) {
    return NextResponse.json({ error: "PLACES_DISABLED" }, { status: 404 });
  }

  const guard = await guardPlacesRequest(request);
  if ("error" in guard) return guard.error;

  const placeId = guard.params.get("placeId") ?? "";
  const main = (guard.params.get("main") ?? "").trim().slice(0, 200);
  if (!PLACE_ID.test(placeId) || !main) {
    return NextResponse.json({ error: "INVALID_PLACE" }, { status: 400 });
  }
  const secondary = (guard.params.get("secondary") ?? "").trim().slice(0, 300);
  const city = (guard.params.get("city") ?? "").trim();

  const parts = await placeAddressParts({ placeId, sessionToken: guard.sessionToken, language: guard.language });
  return NextResponse.json({ location: composePlaceLocation({ main, secondary }, parts, city) });
}
