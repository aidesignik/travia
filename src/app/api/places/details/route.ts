import { NextResponse } from "next/server";
import { composePlaceLocation, googleMapsEnabled, placeAddressParts, resolvePlaceSelection } from "@/lib/googleMaps";
import { guardPlacesRequest } from "@/lib/placesRequest";

const PLACE_ID = /^[A-Za-z0-9_-]{10,400}$/;

// Called once when a suggestion is picked: ends the autocomplete session
// (which is what makes its keystrokes free). Returns the exact-location
// text (name, street, borough) and the city it's in. With `derive=1` (the
// single route field) the city comes from Google; otherwise (the older
// two-field forms) the location is composed relative to the `city` the
// form already has. If the details call fails, both are still worked out
// from the suggestion's own text, so picking always works.
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
  if (guard.params.get("derive") === "1") {
    return NextResponse.json(resolvePlaceSelection({ main, secondary }, parts));
  }
  return NextResponse.json({ location: composePlaceLocation({ main, secondary }, parts, city), city });
}
